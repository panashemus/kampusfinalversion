-- # Kampus - marketplace payments, image support, reports, push subscriptions
-- 1. hustles: add reference_code, status, payment_ref_id, images columns + seller_id default
-- 2. feed_posts: add images column
-- 3. reports table for community moderation
-- 4. push_subscriptions table for web push
-- 5. hustles RLS opened to all authenticated users
-- 6. post_media public storage bucket

-- hustles columns
ALTER TABLE hustles
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS payment_ref_id text,
  ADD COLUMN IF NOT EXISTS images text[];

ALTER TABLE hustles
  ALTER COLUMN seller_id SET DEFAULT auth.uid();

-- feed_posts columns
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS images text[];

-- reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own_or_admin" ON reports;
CREATE POLICY "reports_select_own_or_admin" ON reports
  FOR SELECT TO authenticated
  USING (
    auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_update_admin" ON reports;
CREATE POLICY "reports_update_admin" ON reports
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "reports_delete_admin" ON reports;
CREATE POLICY "reports_delete_admin" ON reports
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(endpoint, user_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_select_own" ON push_subscriptions;
CREATE POLICY "push_subs_select_own" ON push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_insert_own" ON push_subscriptions;
CREATE POLICY "push_subs_insert_own" ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_delete_own" ON push_subscriptions;
CREATE POLICY "push_subs_delete_own" ON push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- hustles RLS: open to authenticated
DROP POLICY IF EXISTS "hustles_select_subscribed" ON hustles;
DROP POLICY IF EXISTS "hustles_select_authenticated" ON hustles;
CREATE POLICY "hustles_select_authenticated" ON hustles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hustles_insert_subscribed" ON hustles;
DROP POLICY IF EXISTS "hustles_insert_authenticated" ON hustles;
CREATE POLICY "hustles_insert_authenticated" ON hustles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

-- post_media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('post_media', 'post_media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "post_media_read_public" ON storage.objects;
CREATE POLICY "post_media_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'post_media');

DROP POLICY IF EXISTS "post_media_insert_authenticated" ON storage.objects;
CREATE POLICY "post_media_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post_media');

DROP POLICY IF EXISTS "post_media_delete_own" ON storage.objects;
CREATE POLICY "post_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post_media' AND owner = auth.uid());
