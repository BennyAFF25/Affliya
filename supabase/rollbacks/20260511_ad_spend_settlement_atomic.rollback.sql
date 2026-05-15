DROP FUNCTION IF EXISTS public.settle_live_ad_spend(text);
DROP INDEX IF EXISTS public.wallet_deductions_settlement_key_unique;

ALTER TABLE public.wallet_deductions
  DROP COLUMN IF EXISTS settlement_key,
  DROP COLUMN IF EXISTS settlement_after,
  DROP COLUMN IF EXISTS settlement_before;
