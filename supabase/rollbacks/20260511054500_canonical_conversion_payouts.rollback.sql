DROP FUNCTION IF EXISTS public.create_wallet_payouts_for_conversion(uuid, text, text, uuid, numeric, boolean, text, text, integer, timestamptz);

DROP INDEX IF EXISTS public.wallet_payouts_source_event_cycle_unique;
