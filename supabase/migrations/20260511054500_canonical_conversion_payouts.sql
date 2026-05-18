CREATE UNIQUE INDEX IF NOT EXISTS wallet_payouts_source_event_cycle_unique
  ON public.wallet_payouts (source_event_id, cycle_number)
  WHERE source_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_wallet_payouts_for_conversion(
  p_source_event_id uuid,
  p_business_email text,
  p_affiliate_email text,
  p_offer_id uuid,
  p_base_payout_amount numeric,
  p_is_recurring boolean DEFAULT false,
  p_payout_mode text DEFAULT 'upfront',
  p_payout_interval text DEFAULT 'monthly',
  p_payout_cycles integer DEFAULT NULL,
  p_event_created_at timestamptz DEFAULT NOW()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_existing_count integer := 0;
  v_inserted_count integer := 0;
  v_cycles integer := 0;
  v_per_cycle numeric := 0;
  v_base_time timestamptz := COALESCE(p_event_created_at, NOW());
BEGIN
  IF p_source_event_id IS NULL OR p_business_email IS NULL OR p_affiliate_email IS NULL OR p_offer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MISSING_REQUIRED_FIELDS'
    );
  END IF;

  IF COALESCE(p_base_payout_amount, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_PAYOUT_AMOUNT'
    );
  END IF;

  SELECT COUNT(*)
  INTO v_existing_count
  FROM public.wallet_payouts
  WHERE source_event_id = p_source_event_id;

  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'insertedCount', 0,
      'existingCount', v_existing_count
    );
  END IF;

  IF NOT p_is_recurring OR COALESCE(p_payout_mode, 'upfront') = 'upfront' OR COALESCE(p_payout_cycles, 0) <= 1 THEN
    INSERT INTO public.wallet_payouts (
      business_email,
      affiliate_email,
      offer_id,
      amount,
      status,
      source_event_id,
      cycle_number,
      available_at,
      is_recurring
    ) VALUES (
      p_business_email,
      p_affiliate_email,
      p_offer_id,
      p_base_payout_amount,
      'pending',
      p_source_event_id,
      1,
      NOW(),
      COALESCE(p_is_recurring, false)
    )
    ON CONFLICT (source_event_id, cycle_number) WHERE source_event_id IS NOT NULL DO NOTHING;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', v_inserted_count = 0,
      'insertedCount', v_inserted_count,
      'existingCount', CASE WHEN v_inserted_count = 0 THEN 1 ELSE 0 END
    );
  END IF;

  v_cycles := COALESCE(p_payout_cycles, 0);
  v_per_cycle := p_base_payout_amount / v_cycles;

  INSERT INTO public.wallet_payouts (
    business_email,
    affiliate_email,
    offer_id,
    amount,
    status,
    source_event_id,
    cycle_number,
    available_at,
    is_recurring
  )
  SELECT
    p_business_email,
    p_affiliate_email,
    p_offer_id,
    v_per_cycle,
    'pending',
    p_source_event_id,
    gs.cycle_number,
    CASE
      WHEN COALESCE(p_payout_interval, 'monthly') = 'monthly'
        THEN v_base_time + make_interval(months => gs.cycle_number)
      ELSE v_base_time + make_interval(months => gs.cycle_number)
    END,
    true
  FROM generate_series(1, v_cycles) AS gs(cycle_number)
  ON CONFLICT (source_event_id, cycle_number) WHERE source_event_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', v_inserted_count = 0,
    'insertedCount', v_inserted_count,
    'existingCount', CASE WHEN v_inserted_count = 0 THEN v_cycles ELSE 0 END,
    'cycles', v_cycles,
    'perCycleAmount', v_per_cycle
  );
END;
$fn$;
