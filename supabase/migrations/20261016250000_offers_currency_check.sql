-- Existing unsupported non-NULL currencies must be resolved before applying.
-- Do not rewrite historical offer currencies automatically.
BEGIN;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_currency_supported
  CHECK (currency IS NULL OR currency IN ('AUD','USD','GBP','CAD'));
COMMIT;
