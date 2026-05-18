DROP FUNCTION IF EXISTS public.record_wallet_refund(text, uuid, text, text, numeric, text);

DROP INDEX IF EXISTS public.wallet_refunds_source_topup_id_idx;
DROP INDEX IF EXISTS public.wallet_refunds_stripe_refund_id_unique;

ALTER TABLE public.wallet_refunds
  DROP COLUMN IF EXISTS source_topup_id;
