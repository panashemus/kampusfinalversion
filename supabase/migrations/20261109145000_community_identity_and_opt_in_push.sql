-- Keep named questions visibly named, preserve confession privacy, and restore opt-in push dispatch.
BEGIN;

ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS post_kind text;
UPDATE public.feed_posts SET post_kind = CASE WHEN coalesce(is_anonymous,false) THEN 'confession' ELSE 'question' END WHERE post_kind IS NULL;
ALTER TABLE public.feed_posts ALTER COLUMN post_kind SET DEFAULT 'question';
ALTER TABLE public.feed_posts ALTER COLUMN post_kind SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='feed_posts_post_kind_check' AND conrelid='public.feed_posts'::regclass) THEN
  ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_post_kind_check CHECK(post_kind IN ('question','confession'));
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_feed_post_kind() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.post_kind IS DISTINCT FROM OLD.post_kind THEN
   RAISE EXCEPTION 'Post type cannot be changed after publishing';
  END IF;
 ELSE
  NEW.post_kind := coalesce(NEW.post_kind,'question');
 END IF;
 IF NEW.post_kind NOT IN ('question','confession') THEN
  RAISE EXCEPTION 'Invalid post type';
 END IF;
 NEW.is_anonymous := (NEW.post_kind='confession');
 IF NEW.is_anonymous THEN
  NEW.author_name := 'Anonymous';
 ELSE
  SELECT coalesce(nullif(u.username,''),'Student') INTO NEW.author_name
  FROM public.profiles u WHERE u.id=NEW.user_id;
  NEW.author_name := coalesce(NEW.author_name,'Student');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_feed_post_kind() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS feed_post_kind_privacy ON public.feed_posts;
CREATE TRIGGER feed_post_kind_privacy BEFORE INSERT OR UPDATE ON public.feed_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_feed_post_kind();

CREATE OR REPLACE FUNCTION public.enforce_feed_comment_privacy() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE parent_is_anonymous boolean; parent_visibility text; parent_approved boolean;
BEGIN
 SELECT coalesce(p.is_anonymous,false),p.visibility,p.public_approved
 INTO parent_is_anonymous,parent_visibility,parent_approved
 FROM public.feed_posts p WHERE p.id=NEW.post_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
 IF TG_OP='UPDATE' AND (NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
  RAISE EXCEPTION 'Cannot move or reassign a comment';
 END IF;
 NEW.is_anonymous := parent_is_anonymous;
 IF parent_is_anonymous THEN
  NEW.author_name := 'Anonymous';
 ELSE
  SELECT coalesce(nullif(u.username,''),'Student') INTO NEW.author_name
  FROM public.profiles u WHERE u.id=NEW.user_id;
  NEW.author_name := coalesce(NEW.author_name,'Student');
 END IF;
 NEW.is_public := (parent_visibility='public' AND parent_approved);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_feed_comment_privacy() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS feed_comment_privacy ON public.feed_comments;
CREATE TRIGGER feed_comment_privacy BEFORE INSERT ON public.feed_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_feed_comment_privacy();

-- Safe projections: only non-anonymous authors expose their names, identity and avatars.
-- Keep original column order; appending avatar_url is backward compatible with dependent views.
CREATE OR REPLACE VIEW public.feed_preview WITH (security_barrier=true) AS
 SELECT p.id,p.category,p.text,p.upvotes,p.created_at,p.is_anonymous,p.is_blasted,p.impact_score,
 p.visibility,p.public_approved,p.institution,
 CASE WHEN p.is_anonymous THEN NULL::uuid ELSE p.user_id END AS user_id,
 CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE coalesce(nullif(u.username,''),'Student') END AS author_name,
 (auth.uid()=p.user_id) AS is_owner,
 CASE WHEN auth.uid() IS NOT NULL AND NOT p.is_anonymous THEN p.images ELSE ARRAY[]::text[] END AS images,
 CASE WHEN p.is_anonymous THEN NULL::text ELSE u.avatar_url END AS avatar_url
 FROM public.feed_posts p LEFT JOIN public.profiles u ON u.id=p.user_id
 WHERE public.can_read_post(p.id);
CREATE OR REPLACE VIEW public.comment_preview WITH (security_barrier=true) AS
 SELECT c.id,c.post_id,c.text,c.created_at,c.is_public,
 (coalesce(c.is_anonymous,false) OR coalesce(p.is_anonymous,false)) AS is_anonymous,
 CASE WHEN coalesce(c.is_anonymous,false) OR coalesce(p.is_anonymous,false) THEN NULL::uuid ELSE c.user_id END AS user_id,
 CASE WHEN coalesce(c.is_anonymous,false) OR coalesce(p.is_anonymous,false) THEN 'Anonymous' ELSE coalesce(nullif(u.username,''),'Student') END AS author_name,
 (auth.uid()=c.user_id) AS is_owner,
 CASE WHEN coalesce(c.is_anonymous,false) OR coalesce(p.is_anonymous,false) THEN NULL::text ELSE u.avatar_url END AS avatar_url
 FROM public.feed_comments c JOIN public.feed_posts p ON p.id=c.post_id
 LEFT JOIN public.profiles u ON u.id=c.user_id
 WHERE public.can_read_post(c.post_id) AND (auth.uid() IS NOT NULL OR c.is_public);
GRANT SELECT ON public.feed_preview,public.comment_preview TO anon,authenticated;

-- Replies notify the original poster without exposing confession identities.
CREATE OR REPLACE FUNCTION public.handle_new_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid; confession boolean; replier text;
BEGIN
 SELECT p.user_id,coalesce(p.is_anonymous,false) INTO owner_id,confession
 FROM public.feed_posts p WHERE p.id=NEW.post_id;
 IF owner_id IS NOT NULL AND owner_id<>NEW.user_id THEN
  SELECT coalesce(nullif(u.username,''),'Someone') INTO replier FROM public.profiles u WHERE u.id=NEW.user_id;
  INSERT INTO public.notifications(user_id,type,title,body,reference_id)
  VALUES(owner_id,'comment','New reply on Campus Feed',
         CASE WHEN confession THEN 'Someone replied to your confession.' ELSE coalesce(replier,'Someone')||' replied to your question.' END,
         NEW.post_id::text);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_comment() FROM PUBLIC,anon,authenticated;

-- New posts only notify members who deliberately enabled browser push (no blanket alerts).
CREATE OR REPLACE FUNCTION public.notify_new_campus_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.visibility='campus' OR (NEW.visibility='public' AND NEW.public_approved) THEN
  INSERT INTO public.notifications(user_id,type,title,body,reference_id)
  SELECT DISTINCT s.user_id, 'post',
    CASE WHEN NEW.is_anonymous THEN 'New anonymous confession' ELSE 'New question on Campus Feed' END,
    CASE WHEN NEW.is_anonymous THEN 'A new confession has been shared. Join the conversation on KAMPUS.' ELSE 'Someone posted a new campus question. Join the conversation on KAMPUS.' END,
    NEW.id::text
  FROM public.push_subscriptions s JOIN public.profiles u ON u.id=s.user_id
  WHERE s.user_id<>NEW.user_id AND u.verified AND u.email_verified
    AND EXISTS(SELECT 1 FROM auth.users au WHERE au.id=u.id AND au.email_confirmed_at IS NOT NULL);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_new_campus_post() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notify_new_campus_feed_post ON public.feed_posts;
CREATE TRIGGER notify_new_campus_feed_post AFTER INSERT ON public.feed_posts
 FOR EACH ROW EXECUTE FUNCTION public.notify_new_campus_post();

-- Public posts require moderator approval; notify subscribers when first approved.
CREATE OR REPLACE FUNCTION public.notify_approved_public_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.visibility='public' AND NEW.public_approved AND NOT OLD.public_approved THEN
  PERFORM public.notify_new_campus_post_for_approved(NEW.id);
 END IF;
 RETURN NEW;
END $$;
-- Stable helper for moderation-triggered post notifications.
CREATE OR REPLACE FUNCTION public.notify_new_campus_post_for_approved(source_post_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p record;
BEGIN
 SELECT id,user_id,is_anonymous,visibility,public_approved INTO p FROM public.feed_posts WHERE id=source_post_id;
 IF NOT FOUND OR p.visibility<>'public' OR NOT p.public_approved THEN RETURN; END IF;
 INSERT INTO public.notifications(user_id,type,title,body,reference_id)
 SELECT DISTINCT s.user_id,'post',
  CASE WHEN p.is_anonymous THEN 'New anonymous confession' ELSE 'New question on Campus Feed' END,
  CASE WHEN p.is_anonymous THEN 'A new confession has been shared. Join the conversation on KAMPUS.' ELSE 'Someone posted a new campus question. Join the conversation on KAMPUS.' END,
  p.id::text
 FROM public.push_subscriptions s JOIN public.profiles u ON u.id=s.user_id
 WHERE s.user_id<>p.user_id AND u.verified AND u.email_verified
 AND EXISTS(SELECT 1 FROM auth.users au WHERE au.id=u.id AND au.email_confirmed_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.user_id=s.user_id AND n.type='post' AND n.reference_id=p.id::text);
END $$;
REVOKE ALL ON FUNCTION public.notify_new_campus_post_for_approved(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.notify_approved_public_post() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notify_approved_public_feed_post ON public.feed_posts;
CREATE TRIGGER notify_approved_public_feed_post AFTER UPDATE OF public_approved ON public.feed_posts
 FOR EACH ROW WHEN(NEW.public_approved IS TRUE AND OLD.public_approved IS FALSE)
 EXECUTE FUNCTION public.notify_approved_public_post();

-- Claims prevent repeated pg_net deliveries of the same browser/device notification.
CREATE TABLE IF NOT EXISTS public.push_delivery_claims(
 notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(notification_id,subscription_id)
);
ALTER TABLE public.push_delivery_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_delivery_claims FROM PUBLIC,anon,authenticated;

-- pg_net runs after commit. The only transmitted data is a notification UUID;
-- the secret is fetched from Vault, never embedded in SQL source or client JS.
CREATE OR REPLACE FUNCTION public.dispatch_kampus_notification_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE dispatch_secret text;
BEGIN
 IF NEW.type NOT IN ('post','comment','message') THEN RETURN NEW; END IF;
 SELECT decrypted_secret INTO dispatch_secret FROM vault.decrypted_secrets WHERE name='kampus_push_dispatch_2026';
 IF dispatch_secret IS NULL OR length(dispatch_secret)<32 THEN RETURN NEW; END IF;
 PERFORM net.http_post(
  url:='https://www.kampusbw.site/api/push/dispatch',
  body:=jsonb_build_object('notification_id',NEW.id),
  headers:=jsonb_build_object('Content-Type','application/json','x-kampus-push-secret',dispatch_secret),
  timeout_milliseconds:=12000
 );
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 -- Notification records must still save if push infrastructure is temporarily down.
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_kampus_notification_push() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS dispatch_kampus_push ON public.notifications;
CREATE TRIGGER dispatch_kampus_push AFTER INSERT ON public.notifications
 FOR EACH ROW EXECUTE FUNCTION public.dispatch_kampus_notification_push();
COMMIT;
