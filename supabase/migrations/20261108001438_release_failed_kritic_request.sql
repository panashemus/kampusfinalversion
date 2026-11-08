CREATE OR REPLACE FUNCTION public.release_failed_kritic_request(p_user_id uuid, p_bucket text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RETURN false;
  END IF;
  IF p_user_id IS NULL OR p_bucket IS NULL OR p_bucket !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN false;
  END IF;
  UPDATE public.request_budgets
  SET used = used - 1
  WHERE scope = 'kritic:global' AND bucket = p_bucket AND used > 0;
  UPDATE public.request_budgets
  SET used = used - 1
  WHERE scope = 'kritic:' || p_user_id::text AND bucket = p_bucket AND used > 0;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.release_failed_kritic_request(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_failed_kritic_request(uuid,text) TO service_role;
