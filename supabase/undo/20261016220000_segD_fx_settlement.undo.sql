-- Segment D only; no backfill, function, policy or grant changes.
BEGIN;
ALTER TABLE public.wallet_deductions
  DROP COLUMN fx_rate_date,
  DROP COLUMN fx_source,
  DROP COLUMN fx_rate,
  DROP COLUMN original_currency,
  DROP COLUMN original_amount;
ALTER TABLE public.ad_spend_settlements
  DROP COLUMN fx_rate_date,
  DROP COLUMN fx_source,
  DROP COLUMN fx_rate,
  DROP COLUMN original_currency,
  DROP COLUMN original_amount;
COMMIT;
