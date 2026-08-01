-- Rollout 3: feature-flagged business subscription gate at campaign activation boundary.
-- Default is disabled. Enable only when ready with:
-- update public.business_subscription_gate_settings set enabled = true where key = 'campaign_activation';

CREATE TABLE IF NOT EXISTS public.business_subscription_gate_settings (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.business_subscription_gate_settings (key, enabled)
VALUES ('campaign_activation', false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.business_subscription_gate_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_subscription_gate_settings_service_all
ON public.business_subscription_gate_settings;

CREATE POLICY business_subscription_gate_settings_service_all
ON public.business_subscription_gate_settings
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.business_subscription_gate_settings TO authenticated;
GRANT ALL ON public.business_subscription_gate_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.business_subscription_gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NULL,
  business_email text NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'campaign_received_by_business',
    'campaign_review_opened',
    'subscription_gate_viewed',
    'subscription_checkout_started',
    'subscription_checkout_cancelled',
    'subscription_activated',
    'campaign_approved_after_subscription',
    'subscription_gate_dismissed'
  )),
  campaign_id text NULL,
  intended_action text NULL,
  submission_id text NULL,
  return_to text NULL,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_subscription_gate_events_business_idx
ON public.business_subscription_gate_events (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS business_subscription_gate_events_campaign_idx
ON public.business_subscription_gate_events (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS business_subscription_gate_events_type_idx
ON public.business_subscription_gate_events (event_type, created_at DESC);

ALTER TABLE public.business_subscription_gate_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_subscription_gate_events_service_all
ON public.business_subscription_gate_events;

CREATE POLICY business_subscription_gate_events_service_all
ON public.business_subscription_gate_events
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.business_subscription_gate_events TO service_role;

CREATE OR REPLACE FUNCTION public.is_business_subscription_gate_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.business_subscription_gate_settings WHERE key = 'campaign_activation'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.business_has_campaign_launch_entitlement(
  p_business_id uuid,
  p_business_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.business_entitlements be
      WHERE (
        (p_business_id IS NOT NULL AND be.business_id = p_business_id)
        OR (p_business_email IS NOT NULL AND be.business_email = p_business_email)
      )
      AND (
        be.is_grandfathered = true
        OR be.billing_status IN ('grandfathered', 'subscription_active', 'subscription_trialing')
      )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_business_subscription_for_campaign_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_business_email text;
  v_offer_id uuid;
BEGIN
  IF NOT public.is_business_subscription_gate_enabled() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'affiliate_requests' THEN
    IF TG_OP = 'UPDATE'
      AND COALESCE(OLD.status, '') IS DISTINCT FROM COALESCE(NEW.status, '')
      AND LOWER(COALESCE(NEW.status, '')) = 'approved'
    THEN
      v_business_id := NULL;
      v_business_email := NEW.business_email;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'ad_ideas' THEN
    IF TG_OP = 'UPDATE'
      AND COALESCE(OLD.status, '') IS DISTINCT FROM COALESCE(NEW.status, '')
      AND LOWER(COALESCE(NEW.status, '')) = 'approved'
    THEN
      v_business_id := NULL;
      v_business_email := NEW.business_email;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'live_campaigns' THEN
    IF TG_OP = 'INSERT' THEN
      v_business_id := NEW.business_id;
      v_business_email := NEW.business_email;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'live_ads' THEN
    IF TG_OP = 'INSERT' THEN
      v_business_id := NEW.business_id;
      v_business_email := NEW.business_email;
      v_offer_id := NEW.offer_id;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_business_id IS NULL AND v_business_email IS NOT NULL THEN
    SELECT bp.id
    INTO v_business_id
    FROM public.business_profiles bp
    WHERE bp.business_email = v_business_email
    LIMIT 1;
  END IF;

  IF NOT public.business_has_campaign_launch_entitlement(v_business_id, v_business_email) THEN
    RAISE EXCEPTION 'BUSINESS_SUBSCRIPTION_REQUIRED: Activate Nettmark Business to approve and launch affiliate campaigns.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_business_subscription_affiliate_requests
ON public.affiliate_requests;
CREATE TRIGGER enforce_business_subscription_affiliate_requests
BEFORE UPDATE ON public.affiliate_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_subscription_for_campaign_activation();

DROP TRIGGER IF EXISTS enforce_business_subscription_ad_ideas
ON public.ad_ideas;
CREATE TRIGGER enforce_business_subscription_ad_ideas
BEFORE UPDATE ON public.ad_ideas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_subscription_for_campaign_activation();

DROP TRIGGER IF EXISTS enforce_business_subscription_live_campaigns
ON public.live_campaigns;
CREATE TRIGGER enforce_business_subscription_live_campaigns
BEFORE INSERT ON public.live_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_subscription_for_campaign_activation();

DROP TRIGGER IF EXISTS enforce_business_subscription_live_ads
ON public.live_ads;
CREATE TRIGGER enforce_business_subscription_live_ads
BEFORE INSERT ON public.live_ads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_subscription_for_campaign_activation();
