/*
# Kampus — open community feed read/write to all authenticated users

## Purpose
The previous RLS policies on feed_posts and feed_comments required an
active subscription (subscribed_until > now()) for both reading and
writing. This locked free users out of the community feed entirely and
did not account for the new is_admin / is_premium flags. This migration
opens read access to ALL authenticated (verified) users and allows any
authenticated user to insert their own posts and comments — matching the
intent of the requested "Allow authenticated users to read/insert" policies.

## Changes
### feed_posts (modified)
- user_id column: added DEFAULT auth.uid() so client inserts that omit
  user_id still satisfy the INSERT WITH CHECK (auth.uid() = user_id).

### feed_comments (modified)
- user_id column: added DEFAULT auth.uid() (same reason).

### feed_posts RLS (modified)
- SELECT: replaced feed_posts_select_subscribed (subscribed-only) with
  feed_posts_select_authenticated — any authenticated user can read.
- INSERT: replaced feed_posts_insert_subscribed (subscribed-only) with
  feed_posts_insert_authenticated — any authenticated user can insert
  their own rows (auth.uid() = user_id).
- UPDATE: kept feed_posts_update_own (auth.uid() = user_id).
- DELETE: kept feed_posts_delete_own (auth.uid() = user_id).

### feed_comments RLS (modified)
- SELECT: replaced feed_comments_select_subscribed with
  feed_comments_select_authenticated — any authenticated user can read.
- INSERT: replaced feed_comments_insert_subscribed with
  feed_comments_insert_authenticated — any authenticated user can insert
  their own rows (auth.uid() = user_id).
- UPDATE: kept feed_comments_update_own (auth.uid() = user_id).
- DELETE: kept feed_comments_delete_own (auth.uid() = user_id).

## Security
- All policies are scoped TO authenticated (the app has a sign-in screen).
- SELECT uses USING (true) because community feed posts are intentionally
  shared among all logged-in users — this is the app's core social feature.
- INSERT/UPDATE/DELETE enforce ownership via auth.uid() = user_id.
- The DEFAULT auth.uid() on user_id ensures inserts succeed even when the
  client does not explicitly pass user_id.

## Notes
- Idempotent: uses DROP POLICY IF EXISTS before CREATE.
- Safe to re-apply.
- There is no "likes" table in this project; the requested "likes" policies
  are not applicable.
*/

-- ---------- user_id defaults ----------
ALTER TABLE feed_posts
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE feed_comments
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ---------- feed_posts: SELECT ----------
DROP POLICY IF EXISTS "feed_posts_select_subscribed" ON feed_posts;
DROP POLICY IF EXISTS "feed_posts_select_authenticated" ON feed_posts;
CREATE POLICY "feed_posts_select_authenticated" ON feed_posts
  FOR SELECT TO authenticated USING (true);

-- ---------- feed_posts: INSERT ----------
DROP POLICY IF EXISTS "feed_posts_insert_subscribed" ON feed_posts;
DROP POLICY IF EXISTS "feed_posts_insert_authenticated" ON feed_posts;
CREATE POLICY "feed_posts_insert_authenticated" ON feed_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---------- feed_comments: SELECT ----------
DROP POLICY IF EXISTS "feed_comments_select_subscribed" ON feed_comments;
DROP POLICY IF EXISTS "feed_comments_select_authenticated" ON feed_comments;
CREATE POLICY "feed_comments_select_authenticated" ON feed_comments
  FOR SELECT TO authenticated USING (true);

-- ---------- feed_comments: INSERT ----------
DROP POLICY IF EXISTS "feed_comments_insert_subscribed" ON feed_comments;
DROP POLICY IF EXISTS "feed_comments_insert_authenticated" ON feed_comments;
CREATE POLICY "feed_comments_insert_authenticated" ON feed_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
