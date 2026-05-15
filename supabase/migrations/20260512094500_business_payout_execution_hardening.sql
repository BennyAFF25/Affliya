ALTER TABLE public.wallet_payouts
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS payout_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_error_code text,
  ADD COLUMN IF NOT EXISTS payout_error_message text;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_payouts_stripe_payment_intent_id_unique
  ON public.wallet_payouts (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_payouts_stripe_charge_id_unique
  ON public.wallet_payouts (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_payouts_stripe_transfer_id_unique
  ON public.wallet_payouts (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;
