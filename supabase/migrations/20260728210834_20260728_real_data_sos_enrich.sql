/*
# Kampus — real-data schema + SOS enrichment

## Purpose
1. Enrich sos_alerts with the user's identity and location name so the
   1km broadcast notification can say "EMERGENCY: [Name] has triggered an
   assistance alert near [Location]."
2. Add author_name columns to feed_posts and feed_comments so the
   community feed can display real usernames without joins.
3. Add seller_name and description columns to hustles so the Hustle Hub
   can display real seller names and gig descriptions.

## Changes
### sos_alerts (modified)
- `user_id` (uuid, references profiles, nullable) — the requester.
- `user_name` (text) — display name of the requester.
- `location_name` (text) — reverse-geocoded or fallback location label.

### feed_posts (modified)
- `author_name` (text) — display name of the post author.

### feed_comments (modified)
- `author_name` (text) — display name of the comment author.

### hustles (modified)
- `seller_name` (text) — display name of the seller.
- `description` (text) — gig description.

## Security
- sos_alerts: existing anon+authenticated policies already allow all CRUD.
  No policy changes needed.
- feed_posts / feed_comments / hustles: existing subscription-gated policies
  already govern SELECT/INSERT. No policy changes needed.

## Notes
- Idempotent (ADD COLUMN IF NOT EXISTS).
*/

ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_name text,
  ADD COLUMN IF NOT EXISTS location_name text;

ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS author_name text;

ALTER TABLE feed_comments
  ADD COLUMN IF NOT EXISTS author_name text;

ALTER TABLE hustles
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS description text;
