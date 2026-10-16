-- Removes only Segment C objects; cache and FX metadata are discarded.
BEGIN;
DROP FUNCTION public.reserve_launch_hold_fx(text,numeric,text,numeric,text,numeric,text,date,int);
ALTER TABLE public.wallet_holds
  DROP COLUMN original_amount, DROP COLUMN original_currency, DROP COLUMN fx_rate,
  DROP COLUMN fx_source, DROP COLUMN fx_rate_date, DROP COLUMN fx_buffer_bps;
DROP TABLE public.fx_rates;
COMMIT;
