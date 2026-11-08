-- Preserve the existing shared ceiling of 100 requests per UTC day;
-- expand only the verified student's daily allowance to 20.
CREATE OR REPLACE FUNCTION public.reserve_kritic_request() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE daily text:=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD'); n integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.profiles WHERE id=auth.uid() AND verified AND email_verified
 ) THEN RETURN false; END IF;
 INSERT INTO public.request_budgets(scope,bucket) VALUES('kritic:global',daily) ON CONFLICT DO NOTHING;
 SELECT used INTO n FROM public.request_budgets WHERE scope='kritic:global' AND bucket=daily FOR UPDATE;
 IF n>=100 THEN RETURN false; END IF;
 INSERT INTO public.request_budgets(scope,bucket) VALUES('kritic:'||auth.uid()::text,daily) ON CONFLICT DO NOTHING;
 SELECT used INTO n FROM public.request_budgets
 WHERE scope='kritic:'||auth.uid()::text AND bucket=daily FOR UPDATE;
 IF n>=20 THEN RETURN false; END IF;
 UPDATE public.request_budgets SET used=used+1
 WHERE bucket=daily AND scope IN('kritic:global','kritic:'||auth.uid()::text);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_kritic_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_kritic_request() TO authenticated;

-- Private, size-limited assignments: never use Feed media or a public bucket.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('kritic_attachments','kritic_attachments',false,10485760,
       ARRAY['application/pdf','image/png','image/jpeg','image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
 public=false,
 file_size_limit=EXCLUDED.file_size_limit,
 allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE POLICY kritic_attachment_own_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='kritic_attachments'
 AND (storage.foldername(name))[1]=auth.uid()::text
 AND EXISTS(SELECT 1 FROM public.profiles
            WHERE id=auth.uid() AND verified AND email_verified)
);
CREATE POLICY kritic_attachment_own_select ON storage.objects FOR SELECT TO authenticated
USING (
 bucket_id='kritic_attachments'
 AND (storage.foldername(name))[1]=auth.uid()::text
);
CREATE POLICY kritic_attachment_own_delete ON storage.objects FOR DELETE TO authenticated
USING (
 bucket_id='kritic_attachments'
 AND (storage.foldername(name))[1]=auth.uid()::text
);
