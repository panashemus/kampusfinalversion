BEGIN;
CREATE TABLE public.radar_friends (
 requester uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 recipient uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 accepted boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(requester,recipient),CHECK(requester<>recipient));
CREATE UNIQUE INDEX radar_friend_pair ON public.radar_friends(least(requester,recipient),greatest(requester,recipient));
CREATE INDEX radar_friend_recipient ON public.radar_friends(recipient);
CREATE TABLE public.radar_shares (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 lat double precision NOT NULL CHECK(lat BETWEEN -90 AND 90),
 lng double precision NOT NULL CHECK(lng BETWEEN -180 AND 180),
 status_text text NOT NULL DEFAULT '' CHECK(length(status_text)<=80),
 company_welcome boolean NOT NULL DEFAULT false,
 audience text NOT NULL CHECK(audience IN ('friends','selected')),
 selected_ids uuid[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
ALTER TABLE public.radar_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.radar_friends,public.radar_shares FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.radar_can_connect(a uuid,b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a<>b AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.profiles q ON q.id=b
 WHERE p.id=a AND p.verified AND p.email_verified AND q.verified AND q.email_verified)
 AND NOT EXISTS(SELECT 1 FROM public.user_blocks WHERE (user_id=a AND blocked_id=b) OR (user_id=b AND blocked_id=a));
$$;
REVOKE ALL ON FUNCTION public.radar_can_connect(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.radar_friend_action(peer uuid,action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid();
BEGIN
 IF NOT public.is_kampus_member() OR me=peer OR peer IS NULL THEN RAISE EXCEPTION 'Verified membership required'; END IF;
 IF action IN ('remove','decline','cancel') THEN
  DELETE FROM public.radar_friends WHERE (requester=me AND recipient=peer) OR (requester=peer AND recipient=me);RETURN;
 END IF;
 IF action='unblock' THEN DELETE FROM public.user_blocks WHERE user_id=me AND blocked_id=peer;RETURN; END IF;
 IF action='block' THEN
  INSERT INTO public.user_blocks(user_id,blocked_id) VALUES(me,peer) ON CONFLICT DO NOTHING;
  DELETE FROM public.radar_friends WHERE (requester=me AND recipient=peer) OR (requester=peer AND recipient=me);RETURN;
 END IF;
 IF NOT public.radar_can_connect(me,peer) THEN RAISE EXCEPTION 'Connection unavailable'; END IF;
 IF action='request' THEN
  INSERT INTO public.radar_friends(requester,recipient) VALUES(me,peer) ON CONFLICT DO NOTHING;
 ELSIF action='accept' THEN
  UPDATE public.radar_friends SET accepted=true WHERE requester=peer AND recipient=me AND NOT accepted;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable'; END IF;
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
END; $$;

CREATE FUNCTION public.radar_find_friend(handle text) RETURNS TABLE(user_id uuid,username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.username FROM public.profiles p
 WHERE public.is_kampus_member() AND length(trim(handle))>=3
 AND lower(p.username)=lower(trim(leading '@' from trim(handle)))
 AND public.radar_can_connect(auth.uid(),p.id) LIMIT 1;
$$;

CREATE FUNCTION public.radar_start_share(latitude double precision,longitude double precision,
 minutes integer,audience_mode text,recipients uuid[],status text,welcome boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid();
BEGIN
 IF NOT public.is_kampus_member() THEN RAISE EXCEPTION 'Verified membership required'; END IF;
 IF minutes NOT IN (30,60,180) OR minutes IS NULL OR audience_mode NOT IN ('friends','selected') OR audience_mode IS NULL
 OR status IS NULL OR length(status)>80 OR latitude IS NULL OR longitude IS NULL
 OR NOT(latitude BETWEEN -90 AND 90) OR NOT(longitude BETWEEN -180 AND 180)
 OR welcome IS NULL OR cardinality(coalesce(recipients,'{}'))>100
 THEN RAISE EXCEPTION 'Invalid sharing options'; END IF;
 IF audience_mode='selected' AND (coalesce(cardinality(recipients),0)=0 OR EXISTS(
 SELECT 1 FROM unnest(recipients) r WHERE r IS NULL OR NOT public.radar_can_connect(me,r) OR NOT EXISTS(
 SELECT 1 FROM public.radar_friends f WHERE f.accepted AND ((f.requester=me AND f.recipient=r) OR (f.requester=r AND f.recipient=me)))))
 THEN RAISE EXCEPTION 'Select accepted friends'; END IF;
 INSERT INTO public.radar_shares(user_id,lat,lng,status_text,company_welcome,audience,selected_ids,updated_at,expires_at)
 VALUES(me,latitude,longitude,trim(status),welcome,audience_mode,CASE WHEN audience_mode='selected' THEN recipients ELSE '{}' END,now(),now()+make_interval(mins=>minutes))
 ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,status_text=excluded.status_text,
 company_welcome=excluded.company_welcome,audience=excluded.audience,selected_ids=excluded.selected_ids,updated_at=excluded.updated_at,expires_at=excluded.expires_at;
END; $$;

CREATE FUNCTION public.radar_update_position(latitude double precision,longitude double precision) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_kampus_member() THEN RAISE EXCEPTION 'Verified membership required'; END IF;
 IF latitude IS NULL OR longitude IS NULL OR NOT(latitude BETWEEN -90 AND 90) OR NOT(longitude BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Invalid position'; END IF;
 UPDATE public.radar_shares SET lat=latitude,lng=longitude,updated_at=now()
 WHERE user_id=auth.uid() AND expires_at>now() AND updated_at<now()-interval '10 seconds';
 RETURN FOUND;
END; $$;

CREATE FUNCTION public.radar_stop_share() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ DELETE FROM public.radar_shares WHERE user_id=auth.uid(); $$;

CREATE FUNCTION public.radar_snapshot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); result jsonb;
BEGIN
 IF NOT public.is_kampus_member() THEN RAISE EXCEPTION 'Verified membership required'; END IF;
 SELECT jsonb_build_object(
 'friends',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.id,'username',p.username,'accepted',f.accepted,'incoming',f.recipient=me))
 FROM public.radar_friends f JOIN public.profiles p ON p.id=CASE WHEN f.requester=me THEN f.recipient ELSE f.requester END
 WHERE me IN(f.requester,f.recipient) AND public.radar_can_connect(me,p.id)),'[]'),
 'blocked',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.id,'username',p.username)) FROM public.user_blocks b JOIN public.profiles p ON p.id=b.blocked_id WHERE b.user_id=me),'[]'),
 'own',(SELECT to_jsonb(r) FROM public.radar_shares r WHERE r.user_id=me AND r.expires_at>now()),
 'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',r.user_id,'username',p.username,'lat',r.lat,'lng',r.lng,
 'status_text',r.status_text,'company_welcome',r.company_welcome,'updated_at',r.updated_at,'expires_at',r.expires_at))
 FROM public.radar_shares r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.expires_at>now() AND r.updated_at>now()-interval '5 minutes' AND public.radar_can_connect(me,r.user_id)
 AND (r.audience='friends' OR me=ANY(r.selected_ids)) AND EXISTS(SELECT 1 FROM public.radar_friends f
 WHERE f.accepted AND ((f.requester=me AND f.recipient=r.user_id) OR (f.recipient=me AND f.requester=r.user_id)))),'[]')) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.radar_friend_action(uuid,text),public.radar_find_friend(text),public.radar_start_share(double precision,double precision,integer,text,uuid[],text,boolean),public.radar_update_position(double precision,double precision),public.radar_stop_share(),public.radar_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.radar_friend_action(uuid,text),public.radar_find_friend(text),public.radar_start_share(double precision,double precision,integer,text,uuid[],text,boolean),public.radar_update_position(double precision,double precision),public.radar_stop_share(),public.radar_snapshot() TO authenticated;
-- Read access expires immediately above. Physically remove expired coordinates
-- every minute where pg_cron is installed; otherwise configure this job before release.
DO $schedule$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  EXECUTE $job$SELECT cron.schedule('kampus-radar-expiry','* * * * *','DELETE FROM public.radar_shares WHERE expires_at <= now()')$job$;
 END IF;
END $schedule$;
COMMIT;
