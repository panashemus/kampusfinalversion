-- Additive Cirkles metadata; no existing content is updated, hidden or deleted.
BEGIN;
-- Serialize the additive DDL and verify every original field inside this transaction.
LOCK TABLE public.feed_posts,public.feed_comments,public.feed_post_votes IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE cirkles_preserved_rows ON COMMIT DROP AS
 SELECT 'post'::text AS kind,id,md5((to_jsonb(p)-ARRAY['circle_slug','story_prompt','moderation_status','moderation_mode'])::text) AS fingerprint FROM public.feed_posts p
 UNION ALL SELECT 'comment',id,md5((to_jsonb(c)-'moderation_mode')::text) FROM public.feed_comments c
 UNION ALL SELECT 'vote',id,md5(to_jsonb(v)::text) FROM public.feed_post_votes v;
ALTER TABLE public.feed_posts
 ADD COLUMN IF NOT EXISTS circle_slug text DEFAULT NULL,
 ADD COLUMN IF NOT EXISTS story_prompt text DEFAULT NULL,
 ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
 ADD COLUMN IF NOT EXISTS moderation_mode text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.feed_comments ADD COLUMN IF NOT EXISTS moderation_mode text NOT NULL DEFAULT 'legacy';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='cirkles_post_circle' AND conrelid='public.feed_posts'::regclass) THEN
  ALTER TABLE public.feed_posts ADD CONSTRAINT cirkles_post_circle CHECK(circle_slug IS NULL OR circle_slug IN ('tezember','confessions','semester-wrap','holiday-linkup','unpopular-takes'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='cirkles_post_status' AND conrelid='public.feed_posts'::regclass) THEN
  ALTER TABLE public.feed_posts ADD CONSTRAINT cirkles_post_status CHECK(moderation_status IN ('approved','flagged','blocked'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='cirkles_post_prompt' AND conrelid='public.feed_posts'::regclass) THEN
  ALTER TABLE public.feed_posts ADD CONSTRAINT cirkles_post_prompt CHECK(story_prompt IS NULL OR length(story_prompt)<=180);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS cirkles_posts_circle_created ON public.feed_posts(circle_slug,created_at DESC);
CREATE INDEX IF NOT EXISTS cirkles_posts_category_created ON public.feed_posts(category,created_at DESC);
CREATE INDEX IF NOT EXISTS cirkles_posts_created ON public.feed_posts(created_at DESC);
CREATE TABLE IF NOT EXISTS public.cirkles_moderation_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 content_type text NOT NULL CHECK(content_type IN ('post','comment')),matched_layer text NOT NULL,
 matched_rule text NOT NULL,sanitized_snippet text NOT NULL DEFAULT '[submission redacted]' CHECK(sanitized_snippet='[submission redacted]'),
 created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.cirkles_moderation_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cirkles_moderation_logs FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS cirkles_logs_admin ON public.cirkles_moderation_logs;
CREATE POLICY cirkles_logs_admin ON public.cirkles_moderation_logs FOR SELECT TO authenticated USING(public.is_kampus_admin());
GRANT SELECT ON public.cirkles_moderation_logs TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.cirkles_moderation_logs TO service_role;
CREATE INDEX IF NOT EXISTS cirkles_logs_created ON public.cirkles_moderation_logs(created_at DESC);
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.cirkles_budgets(actor uuid NOT NULL,bucket date NOT NULL,kind text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,last_attempt timestamptz NOT NULL DEFAULT '-infinity',PRIMARY KEY(actor,bucket,kind));
CREATE TABLE IF NOT EXISTS private.cirkles_duplicates(actor uuid NOT NULL,kind text NOT NULL,content_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor,kind,content_hash));
ALTER TABLE private.cirkles_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.cirkles_duplicates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.cirkles_budgets,private.cirkles_duplicates FROM PUBLIC,anon,authenticated;

-- Raw inserts and text edits cannot bypass the authoritative server pipeline.
REVOKE INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER ON public.feed_posts,public.feed_comments FROM PUBLIC,anon,authenticated;
REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.feed_post_votes FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; cols text; BEGIN
 FOREACH t IN ARRAY ARRAY['feed_posts','feed_comments'] LOOP
  SELECT string_agg(quote_ident(column_name),',') INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name=t;
  EXECUTE format('REVOKE INSERT (%s), UPDATE (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,t);
 END LOOP;
END $$;
-- Existing public approval UI remains available; RLS/admin RPC protects moderation.
GRANT UPDATE(public_approved) ON public.feed_posts TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_post(source_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.feed_posts p WHERE p.id=source_id AND
 (p.moderation_status='approved' OR p.user_id=auth.uid() OR public.is_kampus_admin()) AND
 ((p.visibility='public' AND p.public_approved) OR
 (auth.uid() IS NOT NULL AND (p.user_id=auth.uid() OR public.is_kampus_admin() OR (p.visibility='campus' AND public.is_kampus_member())))));
$$;
CREATE OR REPLACE VIEW public.feed_preview WITH (security_barrier=true) AS
 SELECT p.id,p.category,p.text,p.upvotes,p.created_at,p.is_anonymous,p.is_blasted,p.impact_score,
 p.visibility,p.public_approved,p.institution,
 CASE WHEN p.is_anonymous THEN NULL::uuid ELSE p.user_id END AS user_id,
 CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE coalesce(nullif(u.username,''),'Student') END AS author_name,
 (auth.uid()=p.user_id) AS is_owner,
 CASE WHEN auth.uid() IS NOT NULL AND NOT p.is_anonymous THEN p.images ELSE ARRAY[]::text[] END AS images,
 CASE WHEN p.is_anonymous THEN NULL::text ELSE u.avatar_url END AS avatar_url,
 p.circle_slug,p.story_prompt,p.moderation_status,
 ((greatest(p.upvotes,0)+least(greatest(coalesce(p.impact_score,0),0),25)+1)::double precision /
 power(greatest(extract(epoch FROM(now()-p.created_at))/3600,0)+2,1.35)) AS cirkles_hot_score
 FROM public.feed_posts p LEFT JOIN public.profiles u ON u.id=p.user_id WHERE public.can_read_post(p.id);
GRANT SELECT ON public.feed_preview TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.reset_public_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.public_approved:=false;
 ELSIF (to_jsonb(NEW)-'public_approved'-'upvotes'-'impact_score'-'moderation_status'-'moderation_mode') IS DISTINCT FROM
       (to_jsonb(OLD)-'public_approved'-'upvotes'-'impact_score'-'moderation_status'-'moderation_mode') THEN NEW.public_approved:=false;
 ELSIF NEW.public_approved IS DISTINCT FROM OLD.public_approved AND NOT public.is_kampus_admin()
 AND current_setting('role',true) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Moderator approval required'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.cirkles_reserve_attempt(actor uuid,kind text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date:=(now() AT TIME ZONE 'UTC')::date; saved boolean;
BEGIN
 IF kind NOT IN ('post','comment') OR actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=actor AND p.verified AND p.email_verified AND u.email_confirmed_at IS NOT NULL) THEN RETURN false; END IF;
 INSERT INTO private.cirkles_budgets(actor,bucket,kind) VALUES(actor,d,kind) ON CONFLICT DO NOTHING;
 UPDATE private.cirkles_budgets b SET attempts=b.attempts+1,last_attempt=now()
 WHERE b.actor=cirkles_reserve_attempt.actor AND b.bucket=d AND b.kind=cirkles_reserve_attempt.kind
 AND b.attempts<CASE WHEN cirkles_reserve_attempt.kind='post' THEN 40 ELSE 150 END
 AND b.last_attempt<now()-CASE WHEN cirkles_reserve_attempt.kind='post' THEN interval '8 seconds' ELSE interval '3 seconds' END;
 saved:=FOUND;RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.cirkles_reserve_ai() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
 INSERT INTO private.cirkles_budgets(actor,bucket,kind) VALUES('00000000-0000-0000-0000-000000000000',d,'semantic') ON CONFLICT DO NOTHING;
 UPDATE private.cirkles_budgets SET attempts=attempts+1,last_attempt=now()
 WHERE actor='00000000-0000-0000-0000-000000000000' AND bucket=d AND kind='semantic' AND attempts<500;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.cirkles_reserve_ai() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cirkles_reserve_ai() TO service_role;

CREATE OR REPLACE FUNCTION public.cirkles_submit(actor uuid,kind text,payload jsonb,review_mode text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; parent public.feed_posts; body text:=trim(payload->>'text'); inst text; hash text;
BEGIN
 IF actor IS NULL OR kind NOT IN ('post','comment') OR review_mode NOT IN ('deterministic','semantic','deterministic_fallback') OR NOT EXISTS(
 SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=actor AND p.verified AND p.email_verified AND u.email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Verified membership required'; END IF;
 IF body IS NULL OR length(body)<(CASE WHEN kind='post' THEN 5 ELSE 2 END) OR length(body)>(CASE WHEN kind='post' THEN 4000 ELSE 2000 END) THEN RAISE EXCEPTION 'Invalid content'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.cirkles_budgets b WHERE b.actor=cirkles_submit.actor AND b.kind=cirkles_submit.kind AND b.last_attempt>now()-interval '1 minute') THEN RAISE EXCEPTION 'Reservation required'; END IF;
 hash:=md5(lower(regexp_replace(body,'\s+',' ','g'))||':'||coalesce(payload->>'post_id',''));
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||kind||hash,0));
 DELETE FROM private.cirkles_duplicates d WHERE d.actor=cirkles_submit.actor AND d.kind=cirkles_submit.kind AND d.content_hash=hash AND d.created_at<now()-interval '15 minutes';
 IF EXISTS(SELECT 1 FROM private.cirkles_duplicates d WHERE d.actor=cirkles_submit.actor AND d.kind=cirkles_submit.kind AND d.content_hash=hash) THEN RAISE EXCEPTION 'Duplicate content'; END IF;
 IF kind='post' THEN
  IF payload->>'category' NOT IN ('Academic','Housing','Tech','General','Textbooks','Beauty') OR payload->>'visibility' NOT IN ('campus','public') OR payload->>'post_kind' NOT IN ('question','confession') THEN RAISE EXCEPTION 'Invalid post options'; END IF;
  SELECT university INTO inst FROM public.profiles WHERE id=actor;
  INSERT INTO public.feed_posts(user_id,category,text,images,visibility,institution,post_kind,circle_slug,story_prompt,moderation_status,moderation_mode)
  VALUES(actor,payload->>'category',body,ARRAY(SELECT jsonb_array_elements_text(coalesce(payload->'images','[]'::jsonb))),payload->>'visibility',inst,
   CASE WHEN payload->>'circle_slug'='confessions' THEN 'confession' ELSE payload->>'post_kind' END,payload->>'circle_slug',payload->>'story_prompt','approved',review_mode) RETURNING id INTO result;
 ELSE
  SELECT * INTO parent FROM public.feed_posts WHERE id=(payload->>'post_id')::uuid;
  IF NOT FOUND OR parent.moderation_status<>'approved' OR NOT(parent.user_id=actor OR parent.visibility='campus' OR (parent.visibility='public' AND parent.public_approved)) THEN RAISE EXCEPTION 'Parent unavailable'; END IF;
  INSERT INTO public.feed_comments(post_id,user_id,text,moderation_mode) VALUES(parent.id,actor,body,review_mode) RETURNING id INTO result;
 END IF;
 INSERT INTO private.cirkles_duplicates(actor,kind,content_hash) VALUES(actor,kind,hash);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.cirkles_reserve_attempt(uuid,text),public.cirkles_submit(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cirkles_reserve_attempt(uuid,text),public.cirkles_submit(uuid,text,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.cirkles_admin_status(source uuid,new_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_kampus_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF new_status NOT IN ('approved','flagged','blocked') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE public.feed_posts SET moderation_status=new_status WHERE id=source;
END $$;
REVOKE ALL ON FUNCTION public.cirkles_admin_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cirkles_admin_status(uuid,text) TO authenticated;

DO $schedule$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('kampus-cirkles-retention','17 2 * * *',
   $job$DELETE FROM public.cirkles_moderation_logs WHERE created_at<now()-interval '30 days'; DELETE FROM private.cirkles_budgets WHERE bucket<current_date-2; DELETE FROM private.cirkles_duplicates WHERE created_at<now()-interval '1 day';$job$);
 END IF;
END $schedule$;
NOTIFY pgrst,'reload schema';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cirkles_preserved_rows old LEFT JOIN (
  SELECT 'post'::text AS kind,id,md5((to_jsonb(p)-ARRAY['circle_slug','story_prompt','moderation_status','moderation_mode'])::text) AS fingerprint FROM public.feed_posts p
  UNION ALL SELECT 'comment',id,md5((to_jsonb(c)-'moderation_mode')::text) FROM public.feed_comments c
  UNION ALL SELECT 'vote',id,md5(to_jsonb(v)::text) FROM public.feed_post_votes v
 ) current USING(kind,id) WHERE current.fingerprint IS DISTINCT FROM old.fingerprint) THEN RAISE EXCEPTION 'Legacy content preservation check failed'; END IF;
END $$;
COMMIT;
