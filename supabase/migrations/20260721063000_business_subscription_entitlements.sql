-- Rollout 1: Business subscription entitlement + grandfathering foundation
-- This migration does not enforce subscription gates against offers/campaigns.

CREATE TABLE IF NOT EXISTS public.business_entitlements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  business_email text NOT NULL,
  billing_status text NOT NULL DEFAULT 'free',
  is_grandfathered boolean NOT NULL DEFAULT false,
  subscription_required boolean NOT NULL DEFAULT true,
  subscription_stripe_customer_id text NULL,
  stripe_subscription_id text NULL,
  subscription_started_at timestamptz NULL,
  subscription_current_period_end timestamptz NULL,
  subscription_cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_entitlements_business_id_key UNIQUE (business_id),
  CONSTRAINT business_entitlements_business_email_key UNIQUE (business_email),
  CONSTRAINT business_entitlements_billing_status_check CHECK (
    billing_status IN (
      'free',
      'grandfathered',
      'subscription_required',
      'subscription_active',
      'subscription_past_due',
      'subscription_cancelled'
    )
  ),
  CONSTRAINT business_entitlements_grandfather_consistency_check CHECK (
    (is_grandfathered = true AND billing_status = 'grandfathered' AND subscription_required = false)
    OR is_grandfathered = false
  )
);

CREATE INDEX IF NOT EXISTS business_entitlements_billing_status_idx
  ON public.business_entitlements (billing_status);

CREATE INDEX IF NOT EXISTS business_entitlements_subscription_required_idx
  ON public.business_entitlements (subscription_required);

CREATE INDEX IF NOT EXISTS business_entitlements_stripe_subscription_id_idx
  ON public.business_entitlements (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.business_entitlement_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_entitlement_id uuid REFERENCES public.business_entitlements(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  business_email text NOT NULL,
  event_type text NOT NULL,
  billing_status text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_entitlement_events_type_check CHECK (
    event_type IN (
      'business_entitlement_created',
      'business_grandfathered',
      'business_subscription_required'
    )
  )
);

CREATE INDEX IF NOT EXISTS business_entitlement_events_business_email_idx
  ON public.business_entitlement_events (business_email, created_at DESC);

CREATE INDEX IF NOT EXISTS business_entitlement_events_event_type_idx
  ON public.business_entitlement_events (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_business_entitlements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_business_entitlements_updated_at ON public.business_entitlements;
CREATE TRIGGER set_business_entitlements_updated_at
BEFORE UPDATE ON public.business_entitlements
FOR EACH ROW EXECUTE FUNCTION public.set_business_entitlements_updated_at();

CREATE OR REPLACE FUNCTION public.record_business_entitlement_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.business_entitlement_events (
      business_entitlement_id,
      business_id,
      business_email,
      event_type,
      billing_status,
      metadata
    ) VALUES (
      NEW.id,
      NEW.business_id,
      NEW.business_email,
      'business_entitlement_created',
      NEW.billing_status,
      jsonb_build_object('subscriptionRequired', NEW.subscription_required)
    );

    IF NEW.is_grandfathered THEN
      INSERT INTO public.business_entitlement_events (
        business_entitlement_id,
        business_id,
        business_email,
        event_type,
        billing_status,
        metadata
      ) VALUES (
        NEW.id,
        NEW.business_id,
        NEW.business_email,
        'business_grandfathered',
        NEW.billing_status,
        jsonb_build_object('source', 'rollout_1_migration')
      );
    ELSIF NEW.subscription_required THEN
      INSERT INTO public.business_entitlement_events (
        business_entitlement_id,
        business_id,
        business_email,
        event_type,
        billing_status,
        metadata
      ) VALUES (
        NEW.id,
        NEW.business_id,
        NEW.business_email,
        'business_subscription_required',
        NEW.billing_status,
        jsonb_build_object('source', 'business_profile_insert_default')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_business_entitlement_event ON public.business_entitlements;
CREATE TRIGGER record_business_entitlement_event
AFTER INSERT ON public.business_entitlements
FOR EACH ROW EXECUTE FUNCTION public.record_business_entitlement_event();

-- Existing businesses at migration time are explicitly grandfathered.
INSERT INTO public.business_entitlements (
  business_id,
  business_email,
  billing_status,
  is_grandfathered,
  subscription_required,
  created_at,
  updated_at
)
SELECT
  bp.id,
  bp.business_email,
  'grandfathered',
  true,
  false,
  now(),
  now()
FROM public.business_profiles bp
ON CONFLICT DO NOTHING;

-- Future businesses get a free/pre-subscription entitlement row.
CREATE OR REPLACE FUNCTION public.ensure_business_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.business_entitlements (
    business_id,
    business_email,
    billing_status,
    is_grandfathered,
    subscription_required,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.business_email,
    'free',
    false,
    true,
    now(),
    now()
  )
  ON CONFLICT (business_id) DO UPDATE
    SET business_email = EXCLUDED.business_email,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_business_entitlement_on_profile_insert ON public.business_profiles;
CREATE TRIGGER ensure_business_entitlement_on_profile_insert
AFTER INSERT ON public.business_profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_business_entitlement();

ALTER TABLE public.business_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_entitlement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_entitlements_self_select ON public.business_entitlements;
CREATE POLICY business_entitlements_self_select
ON public.business_entitlements
FOR SELECT
TO authenticated
USING (business_email = auth.email());

DROP POLICY IF EXISTS business_entitlements_service_all ON public.business_entitlements;
CREATE POLICY business_entitlements_service_all
ON public.business_entitlements
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS business_entitlement_events_service_all ON public.business_entitlement_events;
CREATE POLICY business_entitlement_events_service_all
ON public.business_entitlement_events
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.business_entitlements TO authenticated;
GRANT ALL ON public.business_entitlements TO service_role;
GRANT ALL ON public.business_entitlement_events TO service_role;
