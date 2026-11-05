BEGIN;
-- This boolean helper reveals only the caller's own role.
GRANT EXECUTE ON FUNCTION public.is_kampus_admin() TO anon;
CREATE POLICY foundation_post_admin_update ON public.feed_posts FOR UPDATE TO authenticated USING(public.is_kampus_admin()) WITH CHECK(public.is_kampus_admin());
CREATE POLICY foundation_post_admin_delete ON public.feed_posts FOR DELETE TO authenticated USING(public.is_kampus_admin());
CREATE POLICY foundation_listing_admin_update ON public.hustles FOR UPDATE TO authenticated USING(public.is_kampus_admin()) WITH CHECK(public.is_kampus_admin());
CREATE POLICY foundation_listing_admin_delete ON public.hustles FOR DELETE TO authenticated USING(public.is_kampus_admin());

-- Private buckets make old public URLs stop serving. Retain every object; member
-- clients resolve short-lived signed URLs after RLS checks. No data is deleted.
UPDATE storage.buckets SET public=false WHERE id IN('post_media','avatars');
CREATE POLICY foundation_media_no_anon ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
 USING(bucket_id NOT IN('post_media','avatars'));
CREATE OR REPLACE FUNCTION public.can_read_media(bucket text,path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
 split_part(path,'/',1)=auth.uid()::text OR
 (bucket='avatars' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.avatar_url LIKE '%/object/public/avatars/'||path)) OR
 (bucket='post_media' AND (
 EXISTS(SELECT 1 FROM public.feed_posts p,unnest(p.images) image WHERE NOT p.is_anonymous AND public.can_read_post(p.id) AND image LIKE '%/object/public/post_media/'||path)
 OR EXISTS(SELECT 1 FROM public.hustles h,unnest(h.images) image WHERE public.can_read_listing(h.id) AND image LIKE '%/object/public/post_media/'||path))));
$$;
REVOKE ALL ON FUNCTION public.can_read_media(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_media(text,text) TO authenticated;
CREATE POLICY foundation_media_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id NOT IN('post_media','avatars') OR public.can_read_media(bucket_id,name));
CREATE POLICY foundation_media_read_allow ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id IN('post_media','avatars') AND public.can_read_media(bucket_id,name));
CREATE POLICY foundation_media_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id NOT IN('post_media','avatars') OR (storage.foldername(name))[1]=auth.uid()::text)
 WITH CHECK(bucket_id NOT IN('post_media','avatars') OR (storage.foldername(name))[1]=auth.uid()::text);

-- Reporting accounts does not reveal the reporter or allow changing moderation state.
CREATE TABLE public.user_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),target_id uuid NOT NULL REFERENCES public.profiles(id),reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_reports_insert ON public.user_reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid() AND reporter_id<>target_id);
CREATE POLICY user_reports_read ON public.user_reports FOR SELECT TO authenticated USING(reporter_id=auth.uid() OR public.is_kampus_admin());
GRANT SELECT,INSERT ON public.user_reports TO authenticated;
COMMIT;
