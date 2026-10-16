BEGIN;
-- Revert callers first. Refuse to discard unresolved reservations/reconciliation evidence.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.wallet_refund_attempts WHERE status='pending') THEN
    RAISE EXCEPTION 'Resolve pending refund attempts before undo';
  END IF;
END $$;
DROP FUNCTION public.finish_wallet_refund(uuid,text,text,text,text,text);
DROP FUNCTION public.claim_wallet_refund(text,uuid,numeric,text);
DROP TABLE public.wallet_refund_attempts;
-- Completed refund ledger and embedded debits remain valid financial history.
COMMIT;
