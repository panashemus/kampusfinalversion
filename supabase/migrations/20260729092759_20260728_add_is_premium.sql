/*
# Kampus — add is_premium column to profiles

## Purpose
Introduces a boolean `is_premium` flag on profiles so the frontend can
distinguish between free users, premium subscribers, and admins. Premium
features (Hustle Hub, Campus Feed, Escrow) are gated behind this flag OR
is_admin. Admins automatically bypass all premium gates.

## Changes
### profiles (modified)
- `is_premium` (boolean, NOT NULL, default false) — true when the user
  has an active paid subscription (Plus or Pro tier) or is an admin.

## Security
- No policy changes. The column is readable by the owner via the existing
  profiles_select_own policy and writable only by the owner or the
  service-role edge function.

## Notes
- Idempotent (ADD COLUMN IF NOT EXISTS).
- Standard users default to is_premium = false. Admins get is_admin = true
  (set by the edge function after OTP verification), which the frontend
  treats as an implicit premium bypass.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
