-- Accept the exact college student-mail subdomain. Verification still requires
-- Supabase Auth confirmation of mailbox ownership; no wildcard is introduced.
CREATE OR REPLACE FUNCTION public.is_student_email(email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT lower(split_part(email, '@', 2)) = ANY (ARRAY[
    'ub.ac.bw', 'mopipi.ub.bw', 'student.ub.ac.bw',
    'bac.ac.bw', 'thuto.bac.ac.bw', 'bsbs.ac.bw',
    'biust.ac.bw', 'student.biust.ac.bw',
    'botho.ac.bw', 'student.botho.ac.bw',
    'buan.ac.bw', 'student.buan.ac.bw',
    'student.boitekanelo.ac.bw'
  ]);
$function$;

-- Reconcile existing Boitekanelo signups using only the authoritative Auth
-- email confirmation, and correct old default-UB institution labels.
UPDATE public.profiles AS p
SET
  email_verified = (u.email_confirmed_at IS NOT NULL),
  verified = (u.email_confirmed_at IS NOT NULL),
  university = CASE
    WHEN p.university IS NULL
      OR p.university IN ('UB', 'UB (University of Botswana)', 'University of Botswana')
      THEN 'Boitekanelo College'
    ELSE p.university
  END
FROM auth.users AS u
WHERE u.id = p.id
  AND lower(split_part(u.email, '@', 2)) = 'student.boitekanelo.ac.bw';
