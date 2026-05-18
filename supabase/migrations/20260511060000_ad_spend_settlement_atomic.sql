ALTER TABLE public.wallet_deductions
  ADD COLUMN IF NOT EXISTS settlement_before numeric,
  ADD COLUMN IF NOT EXISTS settlement_after numeric,
  ADD COLUMN IF NOT EXISTS settlement_key text;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_deductions_settlement_key_unique
  ON public.wallet_deductions (settlement_key);

CREATE OR REPLACE FUNCTION public.settle_live_ad_spend(
  p_live_ad_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_live_ad record;
  v_total_topups numeric := 0;
  v_total_deductions numeric := 0;
  v_available_before numeric := 0;
  v_charged_amount numeric := 0;
  v_transferred_before numeric := 0;
  v_transferred_after numeric := 0;
  v_unpaid_before numeric := 0;
  v_unpaid_after numeric := 0;
  v_settlement_key text;
BEGIN
  SELECT
    id,
    affiliate_email,
    business_email,
    offer_id,
    COALESCE(spend, 0) AS spend,
    COALESCE(spend_transferred, 0) AS spend_transferred
  INTO v_live_ad
  FROM public.live_ads
  WHERE id::text = p_live_ad_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'LIVE_AD_NOT_FOUND'
    );
  END IF;

  IF v_live_ad.affiliate_email IS NULL OR v_live_ad.business_email IS NULL OR v_live_ad.offer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_REQUIRED_FIELDS_ON_LIVE_AD',
      'details', jsonb_build_object(
        'affiliateEmail', v_live_ad.affiliate_email,
        'businessEmail', v_live_ad.business_email,
        'offerId', v_live_ad.offer_id
      )
    );
  END IF;

  SELECT COALESCE(SUM(GREATEST(0, COALESCE(amount_net, 0) - COALESCE(amount_refunded, 0))), 0)
  INTO v_total_topups
  FROM public.wallet_topups
  WHERE affiliate_email = v_live_ad.affiliate_email
    AND LOWER(COALESCE(status, '')) IN ('succeeded', 'refunded');

  SELECT COALESCE(SUM(COALESCE(amount, 0)), 0)
  INTO v_total_deductions
  FROM public.wallet_deductions
  WHERE affiliate_email = v_live_ad.affiliate_email;

  v_available_before := GREATEST(0, v_total_topups - v_total_deductions);
  v_transferred_before := COALESCE(v_live_ad.spend_transferred, 0);
  v_unpaid_before := GREATEST(0, COALESCE(v_live_ad.spend, 0) - v_transferred_before);

  IF v_unpaid_before <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'liveAdId', p_live_ad_id,
      'affiliateEmail', v_live_ad.affiliate_email,
      'businessEmail', v_live_ad.business_email,
      'offerId', v_live_ad.offer_id,
      'spend', v_live_ad.spend,
      'transferredBefore', v_transferred_before,
      'transferredAfter', v_transferred_before,
      'unpaidBefore', v_unpaid_before,
      'unpaidAfter', 0,
      'chargedAmount', 0,
      'message', 'No unpaid spend remaining for this ad.',
      'wallet', jsonb_build_object(
        'totalTopups', v_total_topups,
        'totalDeductions', v_total_deductions,
        'availableBalanceBefore', v_available_before,
        'availableBalanceAfter', v_available_before
      )
    );
  END IF;

  IF v_available_before <= 0 OR v_available_before < v_unpaid_before THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_WALLET_BALANCE',
      'liveAdId', p_live_ad_id,
      'spend', v_live_ad.spend,
      'transferredBefore', v_transferred_before,
      'unpaidBefore', v_unpaid_before,
      'availableBalanceBefore', v_available_before,
      'message', 'Affiliate wallet cannot cover current unpaid spend. Campaign should be paused and topped up.'
    );
  END IF;

  v_charged_amount := v_unpaid_before;
  v_transferred_after := v_transferred_before + v_charged_amount;
  v_unpaid_after := GREATEST(0, COALESCE(v_live_ad.spend, 0) - v_transferred_after);
  v_settlement_key := p_live_ad_id || ':' || v_transferred_after::text;

  INSERT INTO public.wallet_deductions (
    affiliate_email,
    business_email,
    offer_id,
    ad_id,
    amount,
    description,
    settlement_before,
    settlement_after,
    settlement_key
  ) VALUES (
    v_live_ad.affiliate_email,
    v_live_ad.business_email,
    v_live_ad.offer_id,
    p_live_ad_id,
    v_charged_amount,
    'Meta ad spend settlement',
    v_transferred_before,
    v_transferred_after,
    v_settlement_key
  )
  ON CONFLICT (settlement_key) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'liveAdId', p_live_ad_id,
      'affiliateEmail', v_live_ad.affiliate_email,
      'businessEmail', v_live_ad.business_email,
      'offerId', v_live_ad.offer_id,
      'spend', v_live_ad.spend,
      'transferredBefore', v_transferred_before,
      'transferredAfter', v_transferred_after,
      'unpaidBefore', v_unpaid_before,
      'unpaidAfter', v_unpaid_after,
      'chargedAmount', 0,
      'message', 'Settlement already processed (ledger idempotent).',
      'settlementKey', v_settlement_key,
      'wallet', jsonb_build_object(
        'totalTopups', v_total_topups,
        'totalDeductions', v_total_deductions + v_charged_amount,
        'availableBalanceBefore', v_available_before,
        'availableBalanceAfter', GREATEST(0, v_available_before - v_charged_amount)
      )
    );
  END IF;

  UPDATE public.live_ads
  SET spend_transferred = v_transferred_after
  WHERE id = v_live_ad.id;

  RETURN jsonb_build_object(
    'success', true,
    'liveAdId', p_live_ad_id,
    'affiliateEmail', v_live_ad.affiliate_email,
    'businessEmail', v_live_ad.business_email,
    'offerId', v_live_ad.offer_id,
    'spend', v_live_ad.spend,
    'transferredBefore', v_transferred_before,
    'transferredAfter', v_transferred_after,
    'unpaidBefore', v_unpaid_before,
    'unpaidAfter', v_unpaid_after,
    'chargedAmount', v_charged_amount,
    'settlementKey', v_settlement_key,
    'wallet', jsonb_build_object(
      'totalTopups', v_total_topups,
      'totalDeductions', v_total_deductions + v_charged_amount,
      'availableBalanceBefore', v_available_before,
      'availableBalanceAfter', GREATEST(0, v_available_before - v_charged_amount)
    )
  );
END;
$$;
