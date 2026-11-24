BEGIN;
-- Separate consent from existing general marketing preferences. No historical backfill.
CREATE TABLE public.cirkles_notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 push_new_posts boolean NOT NULL DEFAULT true,
 email_frequency text NOT NULL DEFAULT 'off' CHECK(email_frequency IN ('off','every','daily','weekly')),
 email_replies boolean NOT NULL DEFAULT false,
 email_version uuid NOT NULL DEFAULT gen_random_uuid(),
 unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE
);
ALTER TABLE public.cirkles_notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cirkles_notification_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT(user_id,push_new_posts,email_frequency,email_replies),INSERT(user_id,push_new_posts,email_frequency,email_replies),UPDATE(user_id,push_new_posts,email_frequency,email_replies) ON public.cirkles_notification_preferences TO authenticated;
GRANT ALL ON public.cirkles_notification_preferences TO service_role;
CREATE POLICY cirkles_prefs_read ON public.cirkles_notification_preferences FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY cirkles_prefs_insert ON public.cirkles_notification_preferences FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND public.is_kampus_member());
CREATE POLICY cirkles_prefs_update ON public.cirkles_notification_preferences FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()) AND public.is_kampus_member());
CREATE FUNCTION public.rotate_cirkles_email_consent() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.email_frequency IS DISTINCT FROM OLD.email_frequency OR NEW.email_replies IS DISTINCT FROM OLD.email_replies THEN
  NEW.email_version:=gen_random_uuid();
  IF (NEW.email_frequency<>'off' OR NEW.email_replies) AND (OLD.email_frequency='off' AND NOT OLD.email_replies) THEN
   NEW.unsubscribe_token:=gen_random_uuid();
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.rotate_cirkles_email_consent() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cirkles_rotate_email_consent BEFORE UPDATE ON public.cirkles_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.rotate_cirkles_email_consent();

CREATE TABLE public.cirkles_email_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 event_key text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('post','reply','digest')),
 post_ids uuid[] NOT NULL CHECK(cardinality(post_ids) BETWEEN 1 AND 100),
 actor_id uuid,
 consent_version uuid NOT NULL,
 due_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','skipped','failed')),
 attempts int NOT NULL DEFAULT 0,
 locked_at timestamptz,
 provider_id text,
 UNIQUE(user_id,event_key)
);
ALTER TABLE public.cirkles_email_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cirkles_email_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.cirkles_email_jobs TO service_role;
CREATE INDEX cirkles_email_jobs_due ON public.cirkles_email_jobs(status,due_at);
CREATE INDEX cirkles_email_jobs_recipient ON public.cirkles_email_jobs(user_id,created_at);

CREATE FUNCTION public.cirkles_notify_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.moderation_status IS DISTINCT FROM 'approved' OR NOT (NEW.visibility='campus' OR (NEW.visibility='public' AND NEW.public_approved IS TRUE)) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.moderation_status='approved' AND (OLD.visibility='campus' OR (OLD.visibility='public' AND OLD.public_approved IS TRUE)) THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO public.notifications(user_id,type,title,body,reference_id)
 SELECT DISTINCT s.user_id,'post','New post in Cirkles','A new conversation is waiting for you on Kampus.',NEW.id::text
 FROM public.push_subscriptions s
 JOIN public.profiles u ON u.id=s.user_id
 JOIN auth.users au ON au.id=u.id
 LEFT JOIN public.cirkles_notification_preferences prefs ON prefs.user_id=u.id
 WHERE s.user_id<>NEW.user_id AND u.verified AND u.email_verified AND au.email_confirmed_at IS NOT NULL
 AND coalesce(prefs.push_new_posts,true)
 AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.user_id=u.id AND b.blocked_id=NEW.user_id) OR (b.user_id=NEW.user_id AND b.blocked_id=u.id))
 AND NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.user_id=u.id AND n.type='post' AND n.reference_id=NEW.id::text);
 INSERT INTO public.cirkles_email_jobs(user_id,event_key,kind,post_ids,actor_id,consent_version,due_at)
 SELECT prefs.user_id,
 CASE WHEN prefs.email_frequency='every' THEN 'post:'||NEW.id::text ELSE 'digest:'||prefs.email_frequency||':'||d.due::text||':'||prefs.email_version::text END,
 CASE WHEN prefs.email_frequency='every' THEN 'post' ELSE 'digest' END,
 ARRAY[NEW.id],CASE WHEN prefs.email_frequency='every' THEN NEW.user_id ELSE NULL END,prefs.email_version,d.due
 FROM public.cirkles_notification_preferences prefs
 JOIN public.profiles u ON u.id=prefs.user_id JOIN auth.users au ON au.id=u.id
 CROSS JOIN LATERAL (SELECT CASE prefs.email_frequency WHEN 'daily' THEN (date_trunc('day',now() AT TIME ZONE 'Africa/Gaborone')+interval '1 day 8 hours') AT TIME ZONE 'Africa/Gaborone' WHEN 'weekly' THEN (date_trunc('week',now() AT TIME ZONE 'Africa/Gaborone')+interval '7 days 8 hours') AT TIME ZONE 'Africa/Gaborone' ELSE now() END AS due) d
 WHERE prefs.email_frequency<>'off' AND prefs.user_id<>NEW.user_id AND u.verified AND u.email_verified AND au.email_confirmed_at IS NOT NULL AND au.email IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.user_id=u.id AND b.blocked_id=NEW.user_id) OR (b.user_id=NEW.user_id AND b.blocked_id=u.id))
 ON CONFLICT(user_id,event_key) DO UPDATE SET post_ids=array_append(public.cirkles_email_jobs.post_ids,NEW.id)
 WHERE public.cirkles_email_jobs.kind='digest' AND public.cirkles_email_jobs.status='pending' AND cardinality(public.cirkles_email_jobs.post_ids)<100 AND NOT NEW.id=ANY(public.cirkles_email_jobs.post_ids);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cirkles_notify_post() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notify_new_campus_feed_post ON public.feed_posts;
DROP TRIGGER IF EXISTS notify_approved_public_feed_post ON public.feed_posts;
CREATE TRIGGER cirkles_notify_post AFTER INSERT OR UPDATE OF moderation_status,public_approved,visibility ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.cirkles_notify_post();

CREATE FUNCTION public.cirkles_queue_reply_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.cirkles_email_jobs(user_id,event_key,kind,post_ids,actor_id,consent_version,due_at)
 SELECT p.user_id,'reply:'||NEW.id::text,'reply',ARRAY[p.id],NEW.user_id,prefs.email_version,now()
 FROM public.feed_posts p JOIN public.cirkles_notification_preferences prefs ON prefs.user_id=p.user_id
 JOIN public.profiles u ON u.id=p.user_id JOIN auth.users au ON au.id=u.id
 WHERE p.id=NEW.post_id AND p.user_id<>NEW.user_id AND p.moderation_status='approved'
 AND (p.visibility='campus' OR (p.visibility='public' AND p.public_approved))
 AND prefs.email_replies AND u.verified AND u.email_verified AND au.email_confirmed_at IS NOT NULL AND au.email IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.user_id=p.user_id AND b.blocked_id=NEW.user_id) OR (b.user_id=NEW.user_id AND b.blocked_id=p.user_id))
 ON CONFLICT(user_id,event_key) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cirkles_queue_reply_email() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cirkles_queue_reply_email AFTER INSERT ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.cirkles_queue_reply_email();

-- Lease jobs atomically; never send stale events. Bound global daily volume to protect OTP capacity.
CREATE FUNCTION public.claim_cirkles_email_jobs() RETURNS SETOF public.cirkles_email_jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE available int;
BEGIN
 IF NOT pg_try_advisory_xact_lock(72114991) THEN RETURN; END IF;
 UPDATE public.cirkles_email_jobs SET status='skipped' WHERE status IN ('pending','processing') AND due_at<now()-interval '24 hours';
 UPDATE public.cirkles_email_jobs SET status='failed' WHERE attempts>=4 AND (status='pending' OR (status='processing' AND locked_at<now()-interval '10 minutes'));
 SELECT greatest(0,60-count(*)::int) INTO available FROM public.cirkles_email_jobs
 WHERE status IN ('sent','processing') AND locked_at>=date_trunc('day',now() AT TIME ZONE 'Africa/Gaborone') AT TIME ZONE 'Africa/Gaborone';
 RETURN QUERY WITH picked AS (
 SELECT j.id FROM public.cirkles_email_jobs j
 WHERE j.due_at<=now() AND j.due_at>=now()-interval '24 hours' AND j.attempts<4
 AND (j.status='pending' OR (j.status='processing' AND j.locked_at<now()-interval '10 minutes'))
 ORDER BY j.due_at,j.id LIMIT least(available,8) FOR UPDATE SKIP LOCKED
 ) UPDATE public.cirkles_email_jobs j SET status='processing',attempts=j.attempts+1,locked_at=now()
 FROM picked WHERE j.id=picked.id RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_cirkles_email_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cirkles_email_jobs() TO service_role;
-- Production scheduler (the test fixture executes all schema and trigger definitions above).
SELECT cron.schedule('kampus-cirkles-email-dispatch','* * * * *',$cron$
 SELECT net.http_post(url:='https://www.kampusbw.site/api/cirkles/notifications/dispatch',
 body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-kampus-push-secret',decrypted_secret),timeout_milliseconds:=35000)
 FROM vault.decrypted_secrets WHERE name='kampus_push_dispatch_2026' AND length(decrypted_secret)>=32
 AND EXISTS(SELECT 1 FROM public.cirkles_email_jobs WHERE due_at<=now() AND status IN ('pending','processing'));
$cron$);
COMMIT;
