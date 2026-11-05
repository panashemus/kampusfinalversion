BEGIN;
CREATE TABLE public.user_blocks (
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,blocked_id),CHECK(user_id<>blocked_id));
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocks_own ON public.user_blocks FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT,DELETE ON public.user_blocks TO authenticated;

CREATE OR REPLACE FUNCTION public.can_message(a text,b text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a<>b AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.profiles q ON q.id::text=b
 WHERE p.id::text=a AND p.verified AND p.email_verified AND q.verified AND q.email_verified AND p.allow_messages AND q.allow_messages)
 AND NOT EXISTS(SELECT 1 FROM public.user_blocks WHERE (user_id::text=a AND blocked_id::text=b) OR (user_id::text=b AND blocked_id::text=a));
$$;
REVOKE ALL ON FUNCTION public.can_message(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_message(text,text) TO authenticated;

CREATE TABLE public.conversation_sources (
 conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
 listing_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(conversation_id,listing_id));
ALTER TABLE public.conversation_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_participant ON public.conversation_sources FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND auth.uid()::text IN(c.participant_a,c.participant_b)));
GRANT SELECT ON public.conversation_sources TO authenticated;

-- Membership and previews are immutable through raw REST updates. A trusted
-- message trigger maintains previews; the RPC serializes pair creation.
REVOKE INSERT,UPDATE ON public.conversations FROM authenticated;
CREATE POLICY foundation_conversation_member ON public.conversations AS RESTRICTIVE FOR SELECT TO authenticated
 USING(auth.uid()::text IN(participant_a,participant_b));
CREATE POLICY foundation_message_member ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND auth.uid()::text IN(c.participant_a,c.participant_b)));
CREATE POLICY foundation_message_send ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK
 (sender_id=auth.uid()::text AND length(text) BETWEEN 1 AND 4000 AND EXISTS
 (SELECT 1 FROM public.conversations c WHERE c.id=conversation_id AND auth.uid()::text IN(c.participant_a,c.participant_b) AND public.can_message(c.participant_a,c.participant_b)));

CREATE OR REPLACE FUNCTION public.open_conversation(peer uuid,listing uuid DEFAULT NULL) RETURNS public.conversations
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mine text:=auth.uid()::text; result public.conversations;
BEGIN
 IF mine IS NULL OR NOT public.can_message(mine,peer::text) THEN RAISE EXCEPTION 'Messaging unavailable for this account'; END IF;
 IF listing IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hustles WHERE id=listing AND seller_id=peer AND public.can_read_listing(id))
 THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(least(mine,peer::text)||':'||greatest(mine,peer::text),0));
 SELECT * INTO result FROM public.conversations WHERE
 (participant_a=mine AND participant_b=peer::text) OR (participant_b=mine AND participant_a=peer::text)
 ORDER BY created_at,id LIMIT 1;
 IF result.id IS NULL THEN
  INSERT INTO public.conversations(participant_a,participant_b) VALUES(least(mine,peer::text),greatest(mine,peer::text)) RETURNING * INTO result;
 END IF;
 IF listing IS NOT NULL THEN INSERT INTO public.conversation_sources(conversation_id,listing_id) VALUES(result.id,listing) ON CONFLICT DO NOTHING; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.open_conversation(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.update_message_preview() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.conversations SET last_message=left(NEW.text,160),last_message_at=NEW.created_at WHERE id=NEW.conversation_id;
 RETURN NEW; END $$;
CREATE TRIGGER foundation_message_preview AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_message_preview();

CREATE TABLE public.saved_items (
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 content_type text NOT NULL CHECK(content_type IN ('post','listing')),content_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,content_type,content_id));
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_read ON public.saved_items FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY saved_delete ON public.saved_items FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY saved_insert ON public.saved_items FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND
 ((content_type='post' AND public.can_read_post(content_id)) OR (content_type='listing' AND public.can_read_listing(content_id))));
GRANT SELECT,INSERT,DELETE ON public.saved_items TO authenticated;

-- Atomic durable request counters; callers cannot raise their own limits.
CREATE TABLE public.request_budgets (scope text NOT NULL,bucket text NOT NULL,used integer NOT NULL DEFAULT 0,PRIMARY KEY(scope,bucket));
ALTER TABLE public.request_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_budgets FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.reserve_kritic_request() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE daily text:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD'); n integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND verified AND email_verified) THEN RETURN false; END IF;
 -- Lock the global budget first so requests cannot overspend across instances.
 INSERT INTO public.request_budgets(scope,bucket) VALUES('kritic:global',daily) ON CONFLICT DO NOTHING;
 SELECT used INTO n FROM public.request_budgets WHERE scope='kritic:global' AND bucket=daily FOR UPDATE;
 IF n>=100 THEN RETURN false; END IF;
 INSERT INTO public.request_budgets(scope,bucket) VALUES('kritic:'||auth.uid()::text,daily) ON CONFLICT DO NOTHING;
 SELECT used INTO n FROM public.request_budgets WHERE scope='kritic:'||auth.uid()::text AND bucket=daily FOR UPDATE;
 IF n>=5 THEN RETURN false; END IF;
 UPDATE public.request_budgets SET used=used+1 WHERE bucket=daily AND scope IN('kritic:global','kritic:'||auth.uid()::text);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_kritic_request() FROM PUBLIC;
-- Only the authenticated server path may spend the global budget.
GRANT EXECUTE ON FUNCTION public.reserve_kritic_request() TO authenticated;

CREATE TABLE IF NOT EXISTS public.feed_post_votes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES public.profiles(id),UNIQUE(post_id,user_id));
ALTER TABLE public.feed_post_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY votes_owner ON public.feed_post_votes FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND public.can_read_post(post_id));
CREATE POLICY votes_boundary ON public.feed_post_votes AS RESTRICTIVE FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND public.can_read_post(post_id));
GRANT SELECT,INSERT,DELETE ON public.feed_post_votes TO authenticated;
CREATE OR REPLACE FUNCTION public.sync_vote_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid:=coalesce(NEW.post_id,OLD.post_id); BEGIN
 UPDATE public.feed_posts SET upvotes=(SELECT count(*) FROM public.feed_post_votes WHERE post_id=target) WHERE id=target;
 RETURN NULL; END $$;
CREATE TRIGGER foundation_votes AFTER INSERT OR DELETE ON public.feed_post_votes FOR EACH ROW EXECUTE FUNCTION public.sync_vote_count();
COMMIT;
