-- Additive copies of authoritative live exports; originals untouched.
BEGIN;

CREATE FUNCTION public.credit_wallet_topup_with_currency(p_affiliate_email text, p_checkout_session_id text, p_amount_gross numeric, p_stripe_fees numeric, p_amount_net numeric, p_platform_acct_id text DEFAULT NULL::text, p_nettmark_fee_amount numeric DEFAULT 0, p_credited_amount numeric DEFAULT NULL::numeric, p_currency text DEFAULT NULL::text, p_currency_source text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_credited_amount numeric := COALESCE(p_credited_amount, p_amount_net);
BEGIN
  -- Currency metadata only; preserve all money and replay semantics below.
  IF p_currency IS NOT NULL AND p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid currency format' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL THEN
    p_currency_source := 'unresolved';
  ELSIF p_currency_source IS NULL OR p_currency_source NOT IN ('verified', 'inferred', 'unresolved') THEN
    RAISE EXCEPTION 'Invalid currency source' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.wallet_topups (
    currency, currency_source,
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
    p_currency, p_currency_source,
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
$function$
;

REVOKE ALL ON FUNCTION public.credit_wallet_topup_with_currency(text,text,numeric,numeric,numeric,text,numeric,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_topup_with_currency(text,text,numeric,numeric,numeric,text,numeric,numeric,text,text) TO service_role;

CREATE FUNCTION public.record_wallet_refund_with_currency(p_affiliate_email text, p_source_topup_id uuid, p_stripe_refund_id text, p_stripe_charge_id text, p_amount numeric, p_status text DEFAULT 'succeeded'::text, p_currency text DEFAULT NULL::text, p_currency_source text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_topup record;
  v_existing_refund record;
  v_remaining_before numeric := 0;
  v_refunded_after numeric := 0;
BEGIN
  -- Currency metadata only; preserve all money and replay semantics below.
  IF p_currency IS NOT NULL AND p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Invalid currency format' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL THEN
    p_currency_source := 'unresolved';
  ELSIF p_currency_source IS NULL OR p_currency_source NOT IN ('verified', 'inferred', 'unresolved') THEN
    RAISE EXCEPTION 'Invalid currency source' USING ERRCODE = '22023';
  END IF;
  IF p_affiliate_email IS NULL OR p_source_topup_id IS NULL OR p_stripe_refund_id IS NULL OR p_amount IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_REQUIRED_FIELDS'
    );
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_REFUND_AMOUNT'
    );
  END IF;

  SELECT *
  INTO v_existing_refund
  FROM public.wallet_refunds
  WHERE stripe_refund_id = p_stripe_refund_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'refundId', v_existing_refund.id,
      'stripeRefundId', p_stripe_refund_id,
      'sourceTopupId', v_existing_refund.source_topup_id,
      'amount', v_existing_refund.amount,
      'status', v_existing_refund.status
    );
  END IF;

  SELECT id, affiliate_email, amount_net, COALESCE(amount_refunded, 0) AS amount_refunded, status
  INTO v_topup
  FROM public.wallet_topups
  WHERE id = p_source_topup_id
    AND affiliate_email = p_affiliate_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SOURCE_TOPUP_NOT_FOUND'
    );
  END IF;

  v_remaining_before := GREATEST(0, COALESCE(v_topup.amount_net, 0) - COALESCE(v_topup.amount_refunded, 0));

  IF v_remaining_before < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REFUND_AMOUNT_EXCEEDS_TOPUP_REMAINING',
      'remainingBefore', v_remaining_before,
      'requestedAmount', p_amount
    );
  END IF;

  INSERT INTO public.wallet_refunds (
    currency, currency_source,
    affiliate_email,
    source_topup_id,
    stripe_refund_id,
    stripe_charge_id,
    amount,
    status,
    created_at
  ) VALUES (
    p_currency, p_currency_source,
    p_affiliate_email,
    p_source_topup_id,
    p_stripe_refund_id,
    p_stripe_charge_id,
    p_amount,
    COALESCE(NULLIF(p_status, ''), 'succeeded'),
    NOW()
  );

  v_refunded_after := COALESCE(v_topup.amount_refunded, 0) + p_amount;

  UPDATE public.wallet_topups
  SET
    amount_refunded = v_refunded_after,
    refunded_at = NOW(),
    status = CASE
      WHEN v_refunded_after >= COALESCE(amount_net, 0) THEN 'refunded'
      ELSE status
    END
  WHERE id = p_source_topup_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'stripeRefundId', p_stripe_refund_id,
    'sourceTopupId', p_source_topup_id,
    'remainingBefore', v_remaining_before,
    'refundedAfter', v_refunded_after,
    'remainingAfter', GREATEST(0, COALESCE(v_topup.amount_net, 0) - v_refunded_after)
  );
END;
$function$
;

REVOKE ALL ON FUNCTION public.record_wallet_refund_with_currency(text,uuid,text,text,numeric,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_wallet_refund_with_currency(text,uuid,text,text,numeric,text,text,text) TO service_role;

COMMIT;
