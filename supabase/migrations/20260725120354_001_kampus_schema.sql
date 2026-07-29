/*
# Kampus — core schema, RLS, email whitelist trigger

## Purpose
Lays down the backend for the Kampus student safety + hustle app:
profiles, hazards (campus radar), feed posts + comments, and hustles.

## New Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, unique)
  - `university` (text)
  - `verified` (boolean, default false)
  - `subscribed_until` (timestamptz, nullable)
  - `sentinel_points` (integer, default 0)
- `hazards`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `title` (text)
  - `type` (text)
  - `lat` (double precision)
  - `lng` (double precision)
  - `created_at` (timestamptz, default now())
- `feed_posts`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `category` (text)
  - `text` (text)
  - `upvotes` (integer, default 0)
  - `created_at` (timestamptz, default now())
- `feed_comments`
  - `id` (uuid, primary key)
  - `post_id` (uuid, references feed_posts on delete cascade)
  - `user_id` (uuid, references profiles)
  - `text` (text)
  - `created_at` (timestamptz, default now())
- `hustles`
  - `id` (uuid, primary key)
  - `seller_id` (uuid, references profiles)
  - `title` (text)
  - `price` (numeric)
  - `category` (text)
  - `escrow_ref` (text)
  - `created_at` (timestamptz, default now())

## Security (RLS)
- RLS enabled on every table.
- `profiles`: owner-scoped CRUD (authenticated users manage their own row).
- `hazards`, `feed_posts`, `hustles`: SELECT + INSERT restricted to users
  whose `subscribed_until > NOW()` (the DPO paywall). UPDATE/DELETE are
  owner-scoped.
- `feed_comments`: same subscription-gated SELECT/INSERT, owner-scoped UPDATE/DELETE.

## Email Whitelist Trigger
- `before insert on profiles` trigger auto-verifies emails ending in
  `@bac.ac.bw` or `@ub.ac.bw`, plus the two founder emails.
- Founders also receive a 10-year subscription (`subscribed_until = now() + 10 years`).

## Notes
- Idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
- Safe to re-apply.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  university text,
  verified boolean NOT NULL DEFAULT false,
  subscribed_until timestamptz,
  sentinel_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- hazards ----------
CREATE TABLE IF NOT EXISTS hazards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hazards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hazards_select_subscribed" ON hazards;
CREATE POLICY "hazards_select_subscribed" ON hazards FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "hazards_insert_subscribed" ON hazards;
CREATE POLICY "hazards_insert_subscribed" ON hazards FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "hazards_update_own" ON hazards;
CREATE POLICY "hazards_update_own" ON hazards FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hazards_delete_own" ON hazards;
CREATE POLICY "hazards_delete_own" ON hazards FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- feed_posts ----------
CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  text text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_posts_select_subscribed" ON feed_posts;
CREATE POLICY "feed_posts_select_subscribed" ON feed_posts FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "feed_posts_insert_subscribed" ON feed_posts;
CREATE POLICY "feed_posts_insert_subscribed" ON feed_posts FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "feed_posts_update_own" ON feed_posts;
CREATE POLICY "feed_posts_update_own" ON feed_posts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feed_posts_delete_own" ON feed_posts;
CREATE POLICY "feed_posts_delete_own" ON feed_posts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- feed_comments ----------
CREATE TABLE IF NOT EXISTS feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_comments_select_subscribed" ON feed_comments;
CREATE POLICY "feed_comments_select_subscribed" ON feed_comments FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "feed_comments_insert_subscribed" ON feed_comments;
CREATE POLICY "feed_comments_insert_subscribed" ON feed_comments FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "feed_comments_update_own" ON feed_comments;
CREATE POLICY "feed_comments_update_own" ON feed_comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feed_comments_delete_own" ON feed_comments;
CREATE POLICY "feed_comments_delete_own" ON feed_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- hustles ----------
CREATE TABLE IF NOT EXISTS hustles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  price numeric NOT NULL,
  category text NOT NULL,
  escrow_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hustles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hustles_select_subscribed" ON hustles;
CREATE POLICY "hustles_select_subscribed" ON hustles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "hustles_insert_subscribed" ON hustles;
CREATE POLICY "hustles_insert_subscribed" ON hustles FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.subscribed_until IS NOT NULL
        AND p.subscribed_until > now()
    )
  );

DROP POLICY IF EXISTS "hustles_update_own" ON hustles;
CREATE POLICY "hustles_update_own" ON hustles FOR UPDATE
  TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "hustles_delete_own" ON hustles;
CREATE POLICY "hustles_delete_own" ON hustles FOR DELETE
  TO authenticated USING (auth.uid() = seller_id);

-- ---------- email whitelist + founder subscription trigger ----------
CREATE OR REPLACE FUNCTION kampus_verify_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_founder boolean;
BEGIN
  -- Auto-verify accepted institutional domains and founder emails.
  IF NEW.email ILIKE '%@bac.ac.bw'
     OR NEW.email ILIKE '%@ub.ac.bw'
     OR NEW.email = 'musungwa60@gmail.com'
     OR NEW.email = 'tlhakanelolethabo@gmail.com'
  THEN
    NEW.verified := true;
  END IF;

  -- Founders get a 10-year active subscription.
  is_founder := (NEW.email = 'musungwa60@gmail.com' OR NEW.email = 'tlhakanelolethabo@gmail.com');
  IF is_founder THEN
    NEW.subscribed_until := now() + INTERVAL '10 years';
    NEW.sentinel_points := COALESCE(NEW.sentinel_points, 0) + 1000;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_email ON profiles;
CREATE TRIGGER trg_verify_email
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION kampus_verify_email();
