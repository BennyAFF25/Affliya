BEGIN;
DROP VIEW IF EXISTS public.wallet_ledger_balances;
DROP TABLE IF EXISTS public.wallet_holds;
DROP TABLE IF EXISTS public.wallet_ledger_entries;
ALTER TABLE public.wallet_accounts DROP CONSTRAINT IF EXISTS wallet_accounts_id_currency_key;
COMMIT;
