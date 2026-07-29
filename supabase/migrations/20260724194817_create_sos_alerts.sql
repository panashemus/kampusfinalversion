/*
# Create sos_alerts table

## Purpose
Stores campus SOS / emergency broadcast alerts placed by students on the radar map.
No authentication is required — alerts are public and visible to all users within range.

## New Tables
- `sos_alerts`
  - `id` (uuid, primary key)
  - `lat` (double precision) — GPS latitude of the requester
  - `lng` (double precision) — GPS longitude of the requester
  - `active` (boolean, default true) — whether the alert is still live
  - `created_at` (timestamptz)

## Security
- RLS enabled.
- anon + authenticated can SELECT, INSERT, and UPDATE (to deactivate).
- No DELETE — historical record is preserved.

## Notes
- This is a no-auth public app; all policies use `TO anon, authenticated` with `USING (true)`.
- Active alerts are filtered client-side (active = true).
*/

CREATE TABLE IF NOT EXISTS sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sos_alerts" ON sos_alerts;
CREATE POLICY "anon_select_sos_alerts" ON sos_alerts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sos_alerts" ON sos_alerts;
CREATE POLICY "anon_insert_sos_alerts" ON sos_alerts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sos_alerts" ON sos_alerts;
CREATE POLICY "anon_update_sos_alerts" ON sos_alerts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
