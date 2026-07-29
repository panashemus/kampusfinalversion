/*
# Kampus — OTP verification columns on profiles

## Purpose
Stores the 6-digit email verification code and its expiry on the user's
profile row so the send-verification edge function can write them and the
verify-code path can check them.

## Changes
### profiles (modified)
- `verification_code` (text, nullable) — the 6-digit OTP.
- `verification_code_expires_at` (timestamptz, nullable) — 10-minute window.

## Security
- No policy changes; the existing owner-scoped profile policies already
  govern who can read/write these columns. The edge function uses the
  service role key and therefore bypasses RLS by design.

## Notes
- Idempotent (ADD COLUMN IF NOT EXISTS).
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz;
