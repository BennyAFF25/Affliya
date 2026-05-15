DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*)
  INTO dup_count
  FROM (
    SELECT stripe_id
    FROM public.wallet_topups
    WHERE stripe_id IS NOT NULL
    GROUP BY stripe_id
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot add unique wallet_topups.stripe_id index: % duplicate stripe_id values exist', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_topups_stripe_id_unique
  ON public.wallet_topups (stripe_id)
  WHERE stripe_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.credit_wallet_topup(
  p_affiliate_email text,
  p_checkout_session_id text,
  p_amount_gross numeric,
  p_stripe_fees numeric,
  p_amount_net numeric,
  p_platform_acct_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.wallet_topups (
    affiliate_email,
    amount_gross,
    stripe_fees,
    amount_net,
    stripe_id,
    status,
    platform_acct_id
  ) VALUES (
    p_affiliate_email,
    p_amount_gross,
    p_stripe_fees,
    p_amount_net,
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
    p_stripe_fees,
    p_amount_net,
    COALESCE(p_amount_net, 0)
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
    'email', p_affiliate_email
  );
END;
$$;
