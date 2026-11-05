-- KAMPUS free mode: retire legacy monetization and pre-confirmation profile triggers.
-- Preserve all existing profiles, payment history and functions.
DROP TRIGGER IF EXISTS trg_verify_email ON public.profiles;
DROP TRIGGER IF EXISTS on_payment_created ON public.payments;
