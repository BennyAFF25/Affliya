-- Rollout 5: Controlled Affiliate Launch Fund
-- Selective, non-withdrawable promotional ad credit. No universal signup credit and no payout automation.

CREATE TABLE IF NOT EXISTS public.affiliate_launch_fund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id text NOT NULL,
  affiliate_email text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 10.00,
  currency text NOT NULL DEFAULT 'aud',
  status text NOT NULL DEFAULT 'allocated',
  allocated_for_offer_id uuid NULL REFERENCES public.offers(id) ON DELETE SET NULL,
  allocated_for_campaign_id uuid NULL,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'internal_operator',
  allocated_by text NOT NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  redeemed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT affiliate_launch_fund_allocations_status_check CHECK (status IN ('allocated', 'reserved', 'redeemed', 'expired', 'cancelled')),
  CONSTRAINT affiliate_launch_fund_allocations_amount_check CHECK (amount > 0),
  CONSTRAINT affiliate_launch_fund_allocations_currency_check CHECK (currency = lower(currency) AND char_length(currency) BETWEEN 3 AND 8)
);

CREATE INDEX IF NOT EXISTS affiliate_launch_fund_allocations_affiliate_idx
  ON public.affiliate_launch_fund_allocations (affiliate_email, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_launch_fund_allocations_offer_idx
  ON public.affiliate_launch_fund_allocations (allocated_for_offer_id, status, expires_at DESC)
  WHERE allocated_for_offer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_launch_fund_initial_offer_once_idx
  ON public.affiliate_launch_fund_allocations (affiliate_email, allocated_for_offer_id)
  WHERE source = 'initial_launch_fund'
    AND allocated_for_offer_id IS NOT NULL
    AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.affiliate_launch_fund_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.affiliate_launch_fund_allocations(id) ON DELETE RESTRICT,
  affiliate_id text NOT NULL,
  affiliate_email text NOT NULL,
  offer_id uuid NULL,
  live_ad_id uuid NULL REFERENCES public.live_ads(id) ON DELETE SET NULL,
  transaction_type text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'aud',
  status text NOT NULL DEFAULT 'succeeded',
  settlement_key text NULL,
  source text NOT NULL,
  created_by text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_launch_fund_transactions_type_check CHECK (transaction_type IN ('allocated', 'viewed', 'campaign_started', 'reserved', 'redeemed', 'expired', 'cancelled', 'campaign_went_live')),
  CONSTRAINT affiliate_launch_fund_transactions_status_check CHECK (status IN ('pending', 'succeeded', 'failed', 'reversed')),
  CONSTRAINT affiliate_launch_fund_transactions_amount_check CHECK (amount >= 0),
  CONSTRAINT affiliate_launch_fund_transactions_currency_check CHECK (currency = lower(currency) AND char_length(currency) BETWEEN 3 AND 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_launch_fund_redeem_settlement_once_idx
  ON public.affiliate_launch_fund_transactions (allocation_id, settlement_key)
  WHERE transaction_type = 'redeemed' AND settlement_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS affiliate_launch_fund_transactions_affiliate_idx
  ON public.affiliate_launch_fund_transactions (affiliate_email, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_launch_fund_transactions_live_ad_idx
  ON public.affiliate_launch_fund_transactions (live_ad_id, created_at DESC)
  WHERE live_ad_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.affiliate_launch_fund_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NULL REFERENCES public.affiliate_launch_fund_allocations(id) ON DELETE SET NULL,
  affiliate_id text NULL,
  affiliate_email text NULL,
  offer_id uuid NULL,
  live_ad_id uuid NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'launch_fund_allocated',
    'launch_fund_viewed',
    'launch_fund_campaign_started',
    'launch_fund_redeemed',
    'launch_fund_expired',
    'launch_fund_cancelled',
    'launch_fund_campaign_went_live'
  )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_launch_fund_events_type_idx
  ON public.affiliate_launch_fund_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_launch_fund_events_affiliate_idx
  ON public.affiliate_launch_fund_events (affiliate_email, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_affiliate_launch_fund_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_affiliate_launch_fund_allocations_updated_at
ON public.affiliate_launch_fund_allocations;
CREATE TRIGGER set_affiliate_launch_fund_allocations_updated_at
BEFORE UPDATE ON public.affiliate_launch_fund_allocations
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_launch_fund_updated_at();

CREATE OR REPLACE FUNCTION public.expire_affiliate_launch_fund_allocations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.affiliate_launch_fund_allocations
  SET status = 'expired', updated_at = now()
  WHERE status IN ('allocated', 'reserved')
    AND expires_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.affiliate_launch_fund_events (
    allocation_id,
    affiliate_id,
    affiliate_email,
    offer_id,
    event_type,
    metadata
  )
  SELECT
    a.id,
    a.affiliate_id,
    a.affiliate_email,
    a.allocated_for_offer_id,
    'launch_fund_expired',
    jsonb_build_object('source', 'expire_affiliate_launch_fund_allocations')
  FROM public.affiliate_launch_fund_allocations a
  WHERE a.status = 'expired'
    AND a.expires_at <= now()
    AND NOT EXISTS (
      SELECT 1
      FROM public.affiliate_launch_fund_events e
      WHERE e.allocation_id = a.id
        AND e.event_type = 'launch_fund_expired'
    );

  RETURN v_count;
END;
$$;

ALTER TABLE public.affiliate_launch_fund_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_launch_fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_launch_fund_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliate_launch_fund_allocations_self_select
ON public.affiliate_launch_fund_allocations;
CREATE POLICY affiliate_launch_fund_allocations_self_select
ON public.affiliate_launch_fund_allocations
FOR SELECT
TO authenticated
USING (affiliate_email = auth.email());

DROP POLICY IF EXISTS affiliate_launch_fund_allocations_service_all
ON public.affiliate_launch_fund_allocations;
CREATE POLICY affiliate_launch_fund_allocations_service_all
ON public.affiliate_launch_fund_allocations
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS affiliate_launch_fund_transactions_self_select
ON public.affiliate_launch_fund_transactions;
CREATE POLICY affiliate_launch_fund_transactions_self_select
ON public.affiliate_launch_fund_transactions
FOR SELECT
TO authenticated
USING (affiliate_email = auth.email());

DROP POLICY IF EXISTS affiliate_launch_fund_transactions_service_all
ON public.affiliate_launch_fund_transactions;
CREATE POLICY affiliate_launch_fund_transactions_service_all
ON public.affiliate_launch_fund_transactions
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS affiliate_launch_fund_events_service_all
ON public.affiliate_launch_fund_events;
CREATE POLICY affiliate_launch_fund_events_service_all
ON public.affiliate_launch_fund_events
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.affiliate_launch_fund_allocations TO authenticated;
GRANT SELECT ON public.affiliate_launch_fund_transactions TO authenticated;
GRANT ALL ON public.affiliate_launch_fund_allocations TO service_role;
GRANT ALL ON public.affiliate_launch_fund_transactions TO service_role;
GRANT ALL ON public.affiliate_launch_fund_events TO service_role;
