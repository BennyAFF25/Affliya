BEGIN;
DROP TRIGGER IF EXISTS shadow_ledger_sync_wallet_topups ON public.wallet_topups;
DROP TRIGGER IF EXISTS shadow_ledger_sync_wallet_refunds ON public.wallet_refunds;
DROP TRIGGER IF EXISTS shadow_ledger_sync_wallet_deductions ON public.wallet_deductions;
DROP FUNCTION IF EXISTS public.shadow_ledger_sync_source();
DROP VIEW IF EXISTS public.wallet_ledger_reconciliation;
-- Retain all ledger rows/accounts written by triggers. No source money data is changed.
-- Before re-enabling sync, separately reconcile/resync sources changed while disabled.
COMMIT;
