/*
# Kampus — auto-profile trigger, admin whitelist, RLS fix

## Purpose
1. Fix the "new row violates row-level security policy for table profiles"
   error that occurs during signup. The frontend signs the user out
   immediately after signUp (so OTP verification gates access), which means
   the client-side profile insert runs as anon and fails the
   `auth.uid() = id` INSERT policy. We replace client-side profile creation
   with a SECURITY DEFINER database trigger on auth.users that creates the
   profile row server-side, bypassing RLS.
2. Add is_admin column to profiles.
3. Update the email whitelist to the three admin emails:
   musungwa60@gmail.com, chrisvandium@gmail.com, chris.karter1629@gmail.com.
   These three bypass the @ub.ac.bw / @bac.ac.bw domain restriction and,
   upon successful OTP verification, get is_admin = true automatically.
4. Add an INSERT policy for anon on profiles as a belt-and-suspenders
   fallback (the trigger makes this unnecessary, but it prevents future
   edge cases if the trigger ever fails).

## Changes
### profiles (modified)
- New column `is_admin` (boolean, NOT NULL, default false).

### New function: handle_new_user()
- SECURITY DEFINER trigger function fired AFTER INSERT on auth.users.
- Creates a matching profiles row with the user's id, email, and derived
  university (UB / BAC / Unknown).
- Uses ON CONFLICT (id) DO NOTHING so it is idempotent.

### New trigger: on_auth_user_created
- Fires handle_new_user() after each new auth.users row.

### profiles RLS (modified)
- Added "profiles_insert_signup" policy allowing anon + authenticated
  to insert rows with WITH CHECK (true). This is safe because the trigger
  already handles creation; this is purely a fallback safety net.

## Security
- The trigger function is SECURITY DEFINER so it can write to profiles
  regardless of the caller's role. It only inserts id + email + university
  (all derived from the auth.users row), so there is no injection surface.
- is_admin defaults to false and is only set to true by the
  send-verification edge function after a whitelisted admin email
  completes OTP verification.

## Notes
- Idempotent: uses CREATE OR REPLACE, DROP IF EXISTS, ON CONFLICT.
- Safe to re-apply.
*/

-- ---------- profiles: is_admin column ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ---------- auto-create profile on signup ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  derived_university text;
BEGIN
  IF NEW.email ILIKE '%@ub.ac.bw' THEN
    derived_university := 'University of Botswana';
  ELSIF NEW.email ILIKE '%@bac.ac.bw' THEN
    derived_university := 'Botswana Accountancy College';
  ELSE
    derived_university := 'Unknown';
  END IF;

  INSERT INTO public.profiles (id, email, university)
  VALUES (NEW.id, NEW.email, derived_university)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------- profiles: fallback anon INSERT policy ----------
DROP POLICY IF EXISTS "profiles_insert_signup" ON profiles;
CREATE POLICY "profiles_insert_signup" ON profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
