BEGIN;
DROP FUNCTION IF EXISTS public.credit_wallet_topup_with_currency(text,text,numeric,numeric,numeric,text,numeric,numeric,text,text);
DROP FUNCTION IF EXISTS public.record_wallet_refund_with_currency(text,uuid,text,text,numeric,text,text,text);
COMMIT;
