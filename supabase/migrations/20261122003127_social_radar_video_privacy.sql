-- Approximate pins and permanent selected-audience revocation. No new client table grants.
BEGIN;
CREATE OR REPLACE FUNCTION public.radar_start_share(latitude double precision,longitude double precision,
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
 -- Keep selected relationships locked until consent is stored. A concurrent
 -- removal waits, then the deletion trigger removes that recipient's consent.
 IF audience_mode='selected' THEN
  PERFORM 1 FROM public.radar_friends f WHERE f.accepted
  AND ((f.requester=me AND f.recipient=ANY(recipients)) OR (f.recipient=me AND f.requester=ANY(recipients)))
  ORDER BY f.requester,f.recipient FOR KEY SHARE;
 END IF;
 IF audience_mode='selected' AND (coalesce(cardinality(recipients),0)=0 OR EXISTS(
 SELECT 1 FROM unnest(recipients) r WHERE r IS NULL OR NOT public.radar_can_connect(me,r) OR NOT EXISTS(
 SELECT 1 FROM public.radar_friends f WHERE f.accepted AND ((f.requester=me AND f.recipient=r) OR (f.requester=r AND f.recipient=me)))))
 THEN RAISE EXCEPTION 'Select accepted friends'; END IF;
 INSERT INTO public.radar_shares(user_id,lat,lng,status_text,company_welcome,audience,selected_ids,updated_at,expires_at)
 VALUES(me,round(latitude::numeric,3)::double precision,round(longitude::numeric,3)::double precision,trim(status),welcome,audience_mode,CASE WHEN audience_mode='selected' THEN recipients ELSE '{}' END,now(),now()+make_interval(mins=>minutes))
 ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,status_text=excluded.status_text,
 company_welcome=excluded.company_welcome,audience=excluded.audience,selected_ids=excluded.selected_ids,updated_at=excluded.updated_at,expires_at=excluded.expires_at;
END; $$;

CREATE OR REPLACE FUNCTION public.radar_update_position(latitude double precision,longitude double precision) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_kampus_member() THEN RAISE EXCEPTION 'Verified membership required'; END IF;
 IF latitude IS NULL OR longitude IS NULL OR NOT(latitude BETWEEN -90 AND 90) OR NOT(longitude BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Invalid position'; END IF;
 UPDATE public.radar_shares SET lat=round(latitude::numeric,3)::double precision,lng=round(longitude::numeric,3)::double precision,updated_at=now()
 WHERE user_id=auth.uid() AND expires_at>now() AND updated_at<now()-interval '10 seconds';
 RETURN FOUND;
END; $$;


-- Existing consent and deadlines remain; discard sub-grid precision in place.
UPDATE public.radar_shares SET lat=round(lat::numeric,3)::double precision,
 lng=round(lng::numeric,3)::double precision;

CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.radar_forget_selected_friend() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.radar_shares SET selected_ids=array_remove(selected_ids,OLD.recipient)
 WHERE user_id=OLD.requester AND audience='selected' AND OLD.recipient=ANY(selected_ids);
 UPDATE public.radar_shares SET selected_ids=array_remove(selected_ids,OLD.requester)
 WHERE user_id=OLD.recipient AND audience='selected' AND OLD.requester=ANY(selected_ids);
 RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION private.radar_forget_selected_friend() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER radar_forget_selected_friend AFTER DELETE ON public.radar_friends
 FOR EACH ROW EXECUTE FUNCTION private.radar_forget_selected_friend();

-- Applies to blocks from every Kampus entry point, not only the Radar UI.
CREATE OR REPLACE FUNCTION private.radar_block_revokes_friendship() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.radar_friends WHERE
 (requester=NEW.user_id AND recipient=NEW.blocked_id) OR
 (requester=NEW.blocked_id AND recipient=NEW.user_id);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.radar_block_revokes_friendship() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER radar_block_revokes_friendship AFTER INSERT ON public.user_blocks
 FOR EACH ROW EXECUTE FUNCTION private.radar_block_revokes_friendship();

REVOKE ALL ON FUNCTION public.radar_start_share(double precision,double precision,integer,text,uuid[],text,boolean),
 public.radar_update_position(double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.radar_start_share(double precision,double precision,integer,text,uuid[],text,boolean),
 public.radar_update_position(double precision,double precision) TO authenticated;
COMMIT;
