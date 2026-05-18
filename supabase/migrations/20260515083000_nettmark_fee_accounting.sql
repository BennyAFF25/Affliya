ALTER TABLE public.wallet_topups
  ADD COLUMN IF NOT EXISTS nettmark_fee_amount numeric,
  ADD COLUMN IF NOT EXISTS credited_amount numeric;

ALTER TABLE public.wallet_payouts
  ADD COLUMN IF NOT EXISTS gross_charge_amount numeric,
  ADD COLUMN IF NOT EXISTS nettmark_fee_amount numeric,
  ADD COLUMN IF NOT EXISTS stripe_fee_amount numeric;

UPDATE public.wallet_topups
SET credited_amount = COALESCE(credited_amount, amount_net)
WHERE credited_amount IS NULL;

CREATE TABLE IF NOT EXISTS public.platform_fee_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id text NOT NULL,
  fee_category text NOT NULL DEFAULT 'nettmark_transaction_fee',
  status text NOT NULL DEFAULT 'accrued',
  currency text NOT NULL DEFAULT 'aud',
  amount numeric NOT NULL,
  principal_amount numeric NULL,
  gross_amount numeric NULL,
  stripe_fee_amount numeric NULL,
  stripe_object_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  accrued_at timestamptz NOT NULL DEFAULT NOW(),
  withdrawable_at timestamptz NULL,
  paid_out_at timestamptz NULL,
  payout_batch_id text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_fee_ledger_amount_nonnegative CHECK (amount >= 0),
  CONSTRAINT platform_fee_ledger_status_check CHECK (status IN ('accrued', 'withdrawable', 'paid_out')),
  CONSTRAINT platform_fee_ledger_source_type_check CHECK (source_type IN ('wallet_topup', 'wallet_payout'))
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_fee_ledger_source_unique
  ON public.platform_fee_ledger (source_type, source_id, fee_category);

CREATE INDEX IF NOT EXISTS platform_fee_ledger_status_idx
  ON public.platform_fee_ledger (status, accrued_at DESC);

CREATE INDEX IF NOT EXISTS platform_fee_ledger_source_idx
  ON public.platform_fee_ledger (source_type, source_id);

CREATE OR REPLACE FUNCTION public.credit_wallet_topup(
  p_affiliate_email text,
  p_checkout_session_id text,
  p_amount_gross numeric,
  p_stripe_fees numeric,
  p_amount_net numeric,
  p_platform_acct_id text DEFAULT NULL,
  p_nettmark_fee_amount numeric DEFAULT 0,
  p_credited_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credited_amount numeric := COALESCE(p_credited_amount, p_amount_net);
BEGIN
  INSERT INTO public.wallet_topups (
    affiliate_email,
    amount_gross,
    stripe_fees,
    amount_net,
    credited_amount,
    nettmark_fee_amount,
    stripe_id,
    status,
    platform_acct_id
  ) VALUES (
    p_affiliate_email,
    p_amount_gross,
    p_stripe_fees,
    v_credited_amount,
    v_credited_amount,
    COALESCE(p_nettmark_fee_amount, 0),
    p_checkout_session_id,
    'succeeded',
    p_platform_acct_id
  )
  ON CONFLICT (stripe_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'credited', false,
      'reason', 'duplicate',
      'stripe_id', p_checkout_session_id
    );
  END IF;

  INSERT INTO public.wallets (
    email,
    role,
    last_transaction_id,
    last_transaction_status,
    last_topup_amount,
    last_fee_amount,
    last_net_amount,
    balance
  ) VALUES (
    p_affiliate_email,
    'affiliate',
    p_checkout_session_id,
    'succeeded',
    p_amount_gross,
    COALESCE(p_nettmark_fee_amount, 0),
    v_credited_amount,
    COALESCE(v_credited_amount, 0)
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'affiliate',
      last_transaction_id = EXCLUDED.last_transaction_id,
      last_transaction_status = EXCLUDED.last_transaction_status,
      last_topup_amount = EXCLUDED.last_topup_amount,
      last_fee_amount = EXCLUDED.last_fee_amount,
      last_net_amount = EXCLUDED.last_net_amount,
      balance = COALESCE(public.wallets.balance, 0) + COALESCE(EXCLUDED.last_net_amount, 0);

  RETURN jsonb_build_object(
    'credited', true,
    'stripe_id', p_checkout_session_id,
    'email', p_affiliate_email,
    'credited_amount', v_credited_amount,
    'nettmark_fee_amount', COALESCE(p_nettmark_fee_amount, 0)
  );
END;
$$;
