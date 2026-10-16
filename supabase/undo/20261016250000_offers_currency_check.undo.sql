BEGIN;
ALTER TABLE public.offers DROP CONSTRAINT offers_currency_supported;
COMMIT;
