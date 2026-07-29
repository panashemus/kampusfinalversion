-- Kampus - username column + test account seeder
-- 1. Add username column to profiles (nullable, unique)
-- 2. Seed chris.karter1629@gmail.com with is_admin=false, is_premium=true

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Create unique index on username where not null
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (username) WHERE username IS NOT NULL;

-- Seed test account: chris.karter1629@gmail.com gets is_admin=false, is_premium=true
UPDATE profiles
  SET is_admin = false,
      is_premium = true
  WHERE email = 'chris.karter1629@gmail.com';
