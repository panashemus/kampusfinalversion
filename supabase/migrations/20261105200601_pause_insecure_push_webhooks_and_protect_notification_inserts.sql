-- Pause legacy push webhook functions that embedded service-role/anon JWTs.
-- Preserve notifications, profiles, and all historical records.
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;
DROP TRIGGER IF EXISTS blast_push_trigger ON public.feed_posts;
CREATE OR REPLACE FUNCTION public.trigger_send_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.fire_blast_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.trigger_send_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fire_blast_push() FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;