ALTER TABLE public.wallet_refunds
  ADD COLUMN IF NOT EXISTS source_topup_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_refunds_stripe_refund_id_unique
  ON public.wallet_refunds (stripe_refund_id);

CREATE INDEX IF NOT EXISTS wallet_refunds_source_topup_id_idx
  ON public.wallet_refunds (source_topup_id);

CREATE OR REPLACE FUNCTION public.record_wallet_refund(
  p_affiliate_email text,
  p_source_topup_id uuid,
  p_stripe_refund_id text,
  p_stripe_charge_id text,
  p_amount numeric,
  p_status text DEFAULT 'succeeded'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_topup record;
  v_existing_refund record;
  v_remaining_before numeric := 0;
  v_refunded_after numeric := 0;
BEGIN
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
    affiliate_email,
    source_topup_id,
    stripe_refund_id,
    stripe_charge_id,
    amount,
    status,
    created_at
  ) VALUES (
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
$fn$;
