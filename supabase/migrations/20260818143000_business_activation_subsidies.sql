CREATE TABLE IF NOT EXISTS public.business_activation_subsidies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NULL REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  business_email text NOT NULL,
  offer_id uuid NULL REFERENCES public.offers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'awaiting_subscription' CHECK (
    status IN (
      'awaiting_subscription',
      'available',
      'reserved',
      'partially_consumed',
      'consumed',
      'settled',
      'expired',
      'cancelled'
    )
  ),
  subsidy_amount numeric(10,2) NOT NULL DEFAULT 10.00 CHECK (subsidy_amount >= 0),
  consumed_amount numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (consumed_amount >= 0),
  reserved_for_affiliate_email text NULL,
  consumed_by_affiliate_email text NULL,
  approved_request_id uuid NULL,
  live_ad_id uuid NULL REFERENCES public.live_ads(id) ON DELETE SET NULL,
  subscription_id text NULL,
  reserved_at timestamptz NULL,
  consumed_at timestamptz NULL,
  settled_at timestamptz NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_activation_subsidies_consumed_amount_check CHECK (consumed_amount <= subsidy_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS business_activation_subsidies_business_email_key
  ON public.business_activation_subsidies (business_email);

CREATE UNIQUE INDEX IF NOT EXISTS business_activation_subsidies_offer_id_key
  ON public.business_activation_subsidies (offer_id)
  WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_activation_subsidies_status_idx
  ON public.business_activation_subsidies (status);

CREATE INDEX IF NOT EXISTS business_activation_subsidies_reserved_affiliate_idx
  ON public.business_activation_subsidies (reserved_for_affiliate_email)
  WHERE reserved_for_affiliate_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_revenue_subscription_live(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(p_status, '')) IN ('trialing', 'active');
$$;

CREATE OR REPLACE FUNCTION public.initialize_business_activation_subsidy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_email IS NULL OR btrim(NEW.business_email) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.business_activation_subsidies (
    business_id,
    business_email,
    status
  )
  VALUES (
    NEW.id,
    NEW.business_email,
    'awaiting_subscription'
  )
  ON CONFLICT (business_email) DO UPDATE
    SET business_id = COALESCE(public.business_activation_subsidies.business_id, EXCLUDED.business_id),
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS initialize_business_activation_subsidy ON public.business_profiles;
CREATE TRIGGER initialize_business_activation_subsidy
AFTER INSERT ON public.business_profiles
FOR EACH ROW
EXECUTE FUNCTION public.initialize_business_activation_subsidy();

CREATE OR REPLACE FUNCTION public.sync_business_activation_subsidy_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_status text;
  v_business_id uuid;
  v_next_status text;
BEGIN
  IF NEW.business_email IS NULL OR btrim(NEW.business_email) = '' OR NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_activation_subsidies bas
    WHERE bas.business_email = NEW.business_email
  ) THEN
    RETURN NEW;
  END IF;

  SELECT p.revenue_subscription_status
    INTO v_subscription_status
  FROM public.profiles p
  WHERE p.email = NEW.business_email
  LIMIT 1;

  SELECT bp.id
    INTO v_business_id
  FROM public.business_profiles bp
  WHERE bp.business_email = NEW.business_email
  LIMIT 1;

  v_next_status := CASE
    WHEN public.is_revenue_subscription_live(v_subscription_status) THEN 'available'
    ELSE 'awaiting_subscription'
  END;

  UPDATE public.business_activation_subsidies bas
  SET business_id = COALESCE(v_business_id, bas.business_id),
      offer_id = COALESCE(bas.offer_id, NEW.id),
      status = CASE
        WHEN bas.status IN ('reserved', 'partially_consumed', 'consumed', 'settled', 'expired', 'cancelled')
          THEN bas.status
        WHEN bas.offer_id IS NULL
          THEN v_next_status
        ELSE bas.status
      END,
      updated_at = now()
  WHERE bas.business_email = NEW.business_email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_business_activation_subsidy_offer ON public.offers;
CREATE TRIGGER sync_business_activation_subsidy_offer
AFTER INSERT ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.sync_business_activation_subsidy_offer();

CREATE OR REPLACE FUNCTION public.sync_business_activation_subsidy_for_subscription(
  p_business_email text,
  p_subscription_status text,
  p_subscription_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_email IS NULL OR btrim(p_business_email) = '' THEN
    RETURN;
  END IF;

  UPDATE public.business_activation_subsidies bas
  SET status = CASE
        WHEN bas.status IN ('reserved', 'partially_consumed', 'consumed', 'settled', 'expired', 'cancelled')
          THEN bas.status
        WHEN public.is_revenue_subscription_live(p_subscription_status) AND bas.offer_id IS NOT NULL
          THEN 'available'
        WHEN public.is_revenue_subscription_live(p_subscription_status)
          THEN 'awaiting_subscription'
        WHEN bas.status = 'available'
          THEN 'awaiting_subscription'
        ELSE bas.status
      END,
      subscription_id = COALESCE(p_subscription_id, bas.subscription_id),
      updated_at = now()
  WHERE bas.business_email = p_business_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_business_activation_subsidy_for_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.status, '')) = 'approved'
     AND (TG_OP = 'INSERT' OR lower(coalesce(OLD.status, '')) <> 'approved') THEN
    WITH candidate AS (
      SELECT bas.id
      FROM public.business_activation_subsidies bas
      WHERE bas.offer_id = NEW.offer_id
        AND bas.status = 'available'
      ORDER BY bas.created_at ASC
      LIMIT 1
    )
    UPDATE public.business_activation_subsidies bas
    SET status = 'reserved',
        reserved_for_affiliate_email = NEW.affiliate_email,
        approved_request_id = NEW.id,
        reserved_at = now(),
        updated_at = now()
    WHERE bas.id IN (SELECT id FROM candidate);
  ELSIF TG_OP = 'UPDATE'
    AND lower(coalesce(OLD.status, '')) = 'approved'
    AND lower(coalesce(NEW.status, '')) <> 'approved' THEN
    UPDATE public.business_activation_subsidies bas
    SET status = 'available',
        reserved_for_affiliate_email = NULL,
        approved_request_id = NULL,
        reserved_at = NULL,
        updated_at = now()
    WHERE bas.approved_request_id = NEW.id
      AND bas.status = 'reserved'
      AND bas.consumed_amount = 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reserve_business_activation_subsidy_for_request ON public.affiliate_requests;
CREATE TRIGGER reserve_business_activation_subsidy_for_request
AFTER INSERT OR UPDATE OF status ON public.affiliate_requests
FOR EACH ROW
EXECUTE FUNCTION public.reserve_business_activation_subsidy_for_request();

ALTER TABLE public.business_activation_subsidies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_activation_subsidies_business_select ON public.business_activation_subsidies;
CREATE POLICY business_activation_subsidies_business_select
  ON public.business_activation_subsidies
  FOR SELECT
  USING (auth.email() = business_email);

DROP POLICY IF EXISTS business_activation_subsidies_affiliate_select ON public.business_activation_subsidies;
CREATE POLICY business_activation_subsidies_affiliate_select
  ON public.business_activation_subsidies
  FOR SELECT
  USING (
    status = 'available'
    OR reserved_for_affiliate_email = auth.email()
  );
