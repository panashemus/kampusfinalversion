-- Supabase production prerequisite. Local PGlite fixtures do not provide pg_cron.
DO $install$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  GRANT USAGE ON SCHEMA cron TO postgres;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
 END IF;
END $install$;
