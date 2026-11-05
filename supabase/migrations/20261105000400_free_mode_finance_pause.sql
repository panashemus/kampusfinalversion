-- KAMPUS FREE MODE: Apply AFTER the three foundation migrations.
-- Preserves all historical balances, records, and actual seller listing prices.
-- This is a pause, not a financial settlement or a data purge.
BEGIN;

-- Close the old subscription-only hazard gates. Verification requirements remain.
DROP POLICY IF EXISTS hazards_select_subscribed ON public.hazards;
DROP POLICY IF EXISTS hazards_insert_subscribed ON public.hazards;
DROP POLICY IF EXISTS hazards_select_free ON public.hazards;
DROP POLICY IF EXISTS hazards_insert_free ON public.hazards;
CREATE POLICY hazards_select_free ON public.hazards FOR SELECT TO authenticated
  USING (public.is_kampus_member());
CREATE POLICY hazards_insert_free ON public.hazards FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_kampus_member());

-- Make profile finance/role authority fields immutable even for a retired
-- webhook still deployed with a service role token. This guards the database
-- independently of which client or endpoint was used.
CREATE OR REPLACE FUNCTION public.kampus_free_mode_block_entitlements()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'is_premium', 'subscribed_until', 'tier',
    'payment_ref_code', 'payment_ref_id', 'kritic_unlimited',
    'kritic_sub_until', 'konnect_tier'
  ] LOOP
    IF (to_jsonb(OLD) -> name) IS DISTINCT FROM (to_jsonb(NEW) -> name) THEN
      RAISE EXCEPTION 'Financial and role entitlements are paused' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS kampus_free_mode_block_entitlements ON public.profiles;
CREATE TRIGGER kampus_free_mode_block_entitlements
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.kampus_free_mode_block_entitlements();

-- Prevent browser/API clients from writing privileged profile fields.
-- Explicit column grants are needed: older migrations granted UPDATE on
-- virtually every non-identity profile column (including paid entitlements).
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ',') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles';
  IF cols IS NOT NULL THEN
    EXECUTE format('REVOKE UPDATE (%s) ON public.profiles FROM PUBLIC, anon, authenticated', cols);
  END IF;
END $$;
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ',') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = ANY (ARRAY[
      'username','university','course_code','avatar_url','public_profile',
      'allow_messages','preferences','ewallet_number','kritic_prompts_used'
    ]);
  IF cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', cols);
  END IF;
END $$;

-- Server-side defense in depth for paused finances.
CREATE OR REPLACE FUNCTION public.kampus_free_mode_block_new_transactions()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Kampus is not accepting new payment or escrow transactions'
    USING ERRCODE = '42501';
END; $$;

-- These tables exist in some production environments outside the tracked
-- migrations. Conditional DDL keeps the migration usable in new installs.
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['payments','escrow_transactions'] LOOP
    IF to_regclass(format('public.%I', tab)) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM PUBLIC, anon, authenticated', tab);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
      EXECUTE format('DROP TRIGGER IF EXISTS kampus_free_mode_block_insert ON public.%I', tab);
      EXECUTE format('CREATE TRIGGER kampus_free_mode_block_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kampus_free_mode_block_new_transactions()', tab);
    END IF;
  END LOOP;
END $$;

-- Suspended historical listings are NOT automatically reactivated. A listing
-- can be suspended for reasons other than payment; admin review is required.
-- Existing payment and escrow rows are NOT deleted or marked successful.
COMMIT;
