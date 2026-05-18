DROP INDEX IF EXISTS public.wallet_payouts_stripe_transfer_id_unique;
DROP INDEX IF EXISTS public.wallet_payouts_stripe_charge_id_unique;
DROP INDEX IF EXISTS public.wallet_payouts_stripe_payment_intent_id_unique;

ALTER TABLE public.wallet_payouts
  DROP COLUMN IF EXISTS payout_error_message,
  DROP COLUMN IF EXISTS payout_error_code,
  DROP COLUMN IF EXISTS payout_completed_at,
  DROP COLUMN IF EXISTS stripe_charge_id,
  DROP COLUMN IF EXISTS stripe_payment_intent_id;
