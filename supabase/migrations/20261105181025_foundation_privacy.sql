-- Apply in staging first. Existing content stays campus-only; no financial records change.
BEGIN;

ALTER TABLE public.profiles
 ADD COLUMN IF NOT EXISTS avatar_url text,
 ADD COLUMN IF NOT EXISTS course_code text,
 ADD COLUMN IF NOT EXISTS ewallet_number text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS public_profile boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS allow_messages boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.feed_posts
 ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS is_blasted boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS impact_score integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'campus' CHECK (visibility IN ('campus','public','private')),
 ADD COLUMN IF NOT EXISTS public_approved boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE public.feed_comments
 ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.hustles
 ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'campus' CHECK (visibility IN ('campus','public','private')),
 ADD COLUMN IF NOT EXISTS public_approved boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS institution text,
 ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_kampus_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin);
$$;
REVOKE ALL ON FUNCTION public.is_kampus_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_kampus_admin() TO authenticated;

-- Remove ALL historical profile policies, including permissive signup fallback.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
  EXECUTE format('DROP POLICY %I ON public.profiles',p.policyname);
 END LOOP;
END $$;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
 USING (id=auth.uid() OR public.is_kampus_admin());
CREATE POLICY profiles_edit ON public.profiles FOR UPDATE TO authenticated
 USING (id=auth.uid() OR public.is_kampus_admin())
 WITH CHECK (id=auth.uid() OR public.is_kampus_admin());
REVOKE INSERT, DELETE, UPDATE ON public.profiles FROM anon, authenticated;
-- Preserve existing financial-column behavior pending separate billing approval.
-- Authority fields can ONLY be written by trusted database/service-role operations.
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(column_name),',') INTO cols FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles'
 AND column_name NOT IN ('id','email','is_admin','verified','email_verified','verification_code','verification_code_expires_at','created_at');
 EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated',cols);
END $$;

CREATE OR REPLACE FUNCTION public.is_student_email(email text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT lower(split_part(email,'@',2)) = ANY(ARRAY['ub.ac.bw','mopipi.ub.bw','student.ub.ac.bw','bac.ac.bw','thuto.bac.ac.bw','bsbs.ac.bw','biust.ac.bw','student.biust.ac.bw','botho.ac.bw','student.botho.ac.bw','buan.ac.bw','student.buan.ac.bw']);
$$;
CREATE OR REPLACE FUNCTION public.sync_my_verification() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 UPDATE public.profiles p SET
  email=u.email,
  email_verified=(u.email_confirmed_at IS NOT NULL),
  verified=(u.email_confirmed_at IS NOT NULL AND (public.is_student_email(u.email) OR p.is_admin))
 FROM auth.users u WHERE p.id=auth.uid() AND u.id=p.id;
END $$;
REVOKE ALL ON FUNCTION public.sync_my_verification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_my_verification() TO authenticated;

-- No role elevation based on email. Original signup subscription trigger remains
-- unchanged until the financial review; confirmation is corrected after insertion.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.profiles(id,email,university,username,course_code)
 VALUES (NEW.id,NEW.email,NULL,NULL,left(NEW.raw_user_meta_data->>'course_code',120))
 ON CONFLICT(id) DO NOTHING;
 UPDATE public.profiles SET email_verified=(NEW.email_confirmed_at IS NOT NULL),
 verified=(NEW.email_confirmed_at IS NOT NULL AND public.is_student_email(NEW.email))
 WHERE id=NEW.id;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_auth_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.profiles SET email=NEW.email,email_verified=(NEW.email_confirmed_at IS NOT NULL),
 verified=(NEW.email_confirmed_at IS NOT NULL AND (public.is_student_email(NEW.email) OR is_admin)) WHERE id=NEW.id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS kampus_auth_confirmation ON auth.users;
CREATE TRIGGER kampus_auth_confirmation AFTER UPDATE OF email_confirmed_at,email ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.refresh_auth_confirmation();

-- An additive restrictive boundary closes broad legacy policies without guessing
-- live policy names. Base rows contain identities; browsing uses safe projections.
CREATE POLICY foundation_post_identity ON public.feed_posts AS RESTRICTIVE FOR SELECT TO authenticated
 USING (user_id=auth.uid() OR public.is_kampus_admin());
CREATE POLICY foundation_comment_identity ON public.feed_comments AS RESTRICTIVE FOR SELECT TO authenticated
 USING (user_id=auth.uid() OR public.is_kampus_admin());
CREATE POLICY foundation_hustle_private ON public.hustles AS RESTRICTIVE FOR SELECT TO authenticated
 USING (seller_id=auth.uid() OR public.is_kampus_admin());

CREATE OR REPLACE FUNCTION public.is_kampus_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=auth.uid()
 AND p.verified AND p.email_verified AND u.email_confirmed_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.is_kampus_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_kampus_member() TO anon,authenticated;
CREATE POLICY foundation_post_writer ON public.feed_posts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.is_kampus_member());
CREATE POLICY foundation_comment_writer ON public.feed_comments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.is_kampus_member());
CREATE POLICY foundation_listing_writer ON public.hustles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.is_kampus_member());

CREATE OR REPLACE FUNCTION public.can_read_post(source_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.feed_posts p WHERE p.id=source_id AND
  ((p.visibility='public' AND p.public_approved) OR
   (auth.uid() IS NOT NULL AND (p.user_id=auth.uid() OR public.is_kampus_admin() OR (p.visibility='campus' AND public.is_kampus_member())))));
$$;
REVOKE ALL ON FUNCTION public.can_read_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_post(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.can_read_listing(source_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.hustles h WHERE h.id=source_id AND h.status='active'
 AND (h.expires_at IS NULL OR h.expires_at>now()) AND
 ((h.visibility='public' AND h.public_approved) OR
 (auth.uid() IS NOT NULL AND (h.seller_id=auth.uid() OR public.is_kampus_admin() OR (h.visibility='campus' AND public.is_kampus_member())))));
$$;
REVOKE ALL ON FUNCTION public.can_read_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_listing(uuid) TO anon,authenticated;

-- Intentionally owner-executed views: explicit row predicates and field allowlists
-- are required because definer views bypass underlying RLS. Never add SELECT *.
CREATE VIEW public.feed_preview WITH (security_barrier=true) AS
 SELECT p.id,p.category,p.text,p.upvotes,p.created_at,p.is_anonymous,p.is_blasted,p.impact_score,
 p.visibility,p.public_approved,p.institution,
 CASE WHEN p.is_anonymous THEN NULL ELSE p.user_id END AS user_id,
 CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE coalesce(u.username,'Student') END AS author_name,
 (auth.uid()=p.user_id) AS is_owner,
 CASE WHEN auth.uid() IS NOT NULL AND NOT p.is_anonymous THEN p.images ELSE ARRAY[]::text[] END AS images
 FROM public.feed_posts p LEFT JOIN public.profiles u ON u.id=p.user_id
 WHERE public.can_read_post(p.id);
CREATE VIEW public.comment_preview WITH (security_barrier=true) AS
 SELECT c.id,c.post_id,c.text,c.created_at,c.is_public,
 (c.is_anonymous OR p.is_anonymous) AS is_anonymous,
 CASE WHEN c.is_anonymous OR p.is_anonymous THEN NULL ELSE c.user_id END AS user_id,
 CASE WHEN c.is_anonymous OR p.is_anonymous THEN 'Anonymous' ELSE coalesce(u.username,'Student') END AS author_name,
 (auth.uid()=c.user_id) AS is_owner
 FROM public.feed_comments c JOIN public.feed_posts p ON p.id=c.post_id
 LEFT JOIN public.profiles u ON u.id=c.user_id
 WHERE public.can_read_post(c.post_id) AND (auth.uid() IS NOT NULL OR c.is_public);
CREATE VIEW public.listing_preview WITH (security_barrier=true) AS
 SELECT h.id,h.seller_id,coalesce(p.username,'Student seller') AS seller_name,h.title,h.price,h.category,
 h.description,h.created_at,h.status,h.visibility,h.public_approved,h.institution,h.expires_at,
 CASE WHEN auth.uid() IS NOT NULL THEN h.images ELSE ARRAY[]::text[] END AS images,
 CASE WHEN h.seller_id=auth.uid() OR public.is_kampus_admin() THEN h.reference_code ELSE NULL END AS reference_code,
 CASE WHEN h.seller_id=auth.uid() OR public.is_kampus_admin() THEN h.payment_ref_id ELSE NULL END AS payment_ref_id
 FROM public.hustles h LEFT JOIN public.profiles p ON p.id=h.seller_id
 WHERE public.can_read_listing(h.id) OR (auth.uid() IS NOT NULL AND (h.seller_id=auth.uid() OR public.is_kampus_admin()));
-- Keep financial reference fields off the guest surface entirely.
CREATE VIEW public.public_listings WITH (security_barrier=true) AS
 SELECT id,seller_id,seller_name,title,price,category,description,created_at,status,visibility,public_approved,institution,expires_at,ARRAY[]::text[] AS images
 FROM public.listing_preview WHERE visibility='public' AND public_approved AND status='active' AND (expires_at IS NULL OR expires_at>now());
CREATE VIEW public.profile_directory WITH (security_barrier=true) AS
 SELECT id,coalesce(username,'Student') AS username,university,verified,allow_messages,
 CASE WHEN public_profile THEN avatar_url ELSE NULL END AS avatar_url
 FROM public.profiles WHERE public_profile OR public.is_kampus_member();
GRANT SELECT ON public.feed_preview,public.comment_preview,public.public_listings,public.profile_directory TO anon,authenticated;
GRANT SELECT ON public.listing_preview TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_public_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.public_approved:=false;
 ELSIF (to_jsonb(NEW)-'public_approved'-'upvotes'-'impact_score') IS DISTINCT FROM
       (to_jsonb(OLD)-'public_approved'-'upvotes'-'impact_score') THEN NEW.public_approved:=false;
 ELSIF NEW.public_approved IS DISTINCT FROM OLD.public_approved AND NOT public.is_kampus_admin()
 AND current_setting('role',true) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Moderator approval required';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER foundation_post_approval BEFORE INSERT OR UPDATE ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.reset_public_approval();
CREATE TRIGGER foundation_listing_approval BEFORE INSERT OR UPDATE ON public.hustles FOR EACH ROW EXECUTE FUNCTION public.reset_public_approval();
CREATE POLICY foundation_comment_parent ON public.feed_comments AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (public.can_read_post(post_id));

-- SOS never has anonymous readers or writers; only the requester/admin deactivates.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sos_alerts' LOOP
 EXECUTE format('DROP POLICY %I ON public.sos_alerts',p.policyname); END LOOP;
END $$;
CREATE POLICY sos_read_verified ON public.sos_alerts FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND verified AND email_verified));
CREATE POLICY sos_insert_own ON public.sos_alerts FOR INSERT TO authenticated WITH CHECK
 (user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND verified AND email_verified));
CREATE POLICY sos_update_own ON public.sos_alerts FOR UPDATE TO authenticated
 USING(user_id=auth.uid() OR public.is_kampus_admin()) WITH CHECK(user_id=auth.uid() OR public.is_kampus_admin());

-- Missing nonfinancial tables are restored with explicit owner boundaries.
CREATE TABLE IF NOT EXISTS public.kritic_chats(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id),
 title text NOT NULL,course_code text,university text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.kritic_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),chat_id uuid NOT NULL REFERENCES public.kritic_chats(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id),role text NOT NULL CHECK(role IN ('user','assistant')),content text NOT NULL,
 images text[],benchmark_used text,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.kritic_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kritic_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY foundation_kritic_chats_allow ON public.kritic_chats FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY foundation_kritic_chats_boundary ON public.kritic_chats AS RESTRICTIVE FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY foundation_kritic_messages_allow ON public.kritic_messages FOR ALL TO authenticated
 USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY foundation_kritic_messages_boundary ON public.kritic_messages AS RESTRICTIVE FOR ALL TO authenticated
 USING(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.kritic_chats c WHERE c.id=chat_id AND c.user_id=auth.uid()))
 WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.kritic_chats c WHERE c.id=chat_id AND c.user_id=auth.uid()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.kritic_chats,public.kritic_messages TO authenticated;

-- Revoke anonymous base-table access including undocumented live tables; views
-- receive their own explicit grants. RLS remains enabled even if grants drift.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t.tablename);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('CREATE POLICY foundation_no_anon ON public.%I AS RESTRICTIVE FOR ALL TO anon USING(false) WITH CHECK(false)',t.tablename);
 END LOOP;
 -- Person-to-person location discovery is deferred pending consent/recipient/expiry design.
 IF to_regclass('public.konnect_locations') IS NOT NULL THEN
  EXECUTE 'CREATE POLICY foundation_locations_owner ON public.konnect_locations AS RESTRICTIVE FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid())';
 END IF;
END $$;
-- Public bucket history needs owner-approved remediation. Constrain new uploads.
CREATE POLICY foundation_upload_owner ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (bucket_id NOT IN ('post_media','avatars') OR (storage.foldername(name))[1]=auth.uid()::text);
UPDATE storage.buckets SET file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] WHERE id IN ('post_media','avatars');

CREATE INDEX IF NOT EXISTS foundation_posts_public ON public.feed_posts(visibility,public_approved,created_at DESC);
CREATE INDEX IF NOT EXISTS foundation_comments_post ON public.feed_comments(post_id,created_at);
CREATE INDEX IF NOT EXISTS foundation_listings_public ON public.hustles(visibility,public_approved,status,created_at DESC);
COMMIT;
