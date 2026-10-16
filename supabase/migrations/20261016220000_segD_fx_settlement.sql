-- Segment D only; no backfill, function, policy or grant changes.
BEGIN;
ALTER TABLE public.wallet_deductions
  ADD COLUMN original_amount numeric,
  ADD COLUMN original_currency text,
  ADD COLUMN fx_rate numeric,
  ADD COLUMN fx_source text,
  ADD COLUMN fx_rate_date date;
ALTER TABLE public.ad_spend_settlements
  ADD COLUMN original_amount numeric,
  ADD COLUMN original_currency text,
  ADD COLUMN fx_rate numeric,
  ADD COLUMN fx_source text,
  ADD COLUMN fx_rate_date date;
COMMIT;
