-- Rollout 2: Business subscription Stripe Checkout + webhook sync foundation.
-- Keeps business subscriptions separate from wallets, ad spend, Stripe Connect payouts, and marketplace flows.

ALTER TABLE public.business_entitlements
  DROP CONSTRAINT IF EXISTS business_entitlements_billing_status_check;

ALTER TABLE public.business_entitlements
  ADD CONSTRAINT business_entitlements_billing_status_check CHECK (
    billing_status IN (
      'free',
      'grandfathered',
      'subscription_required',
      'subscription_active',
      'subscription_trialing',
      'subscription_past_due',
      'subscription_unpaid',
      'subscription_incomplete',
      'subscription_cancelled'
    )
  );

ALTER TABLE public.business_entitlement_events
  DROP CONSTRAINT IF EXISTS business_entitlement_events_type_check;

ALTER TABLE public.business_entitlement_events
  ADD CONSTRAINT business_entitlement_events_type_check CHECK (
    event_type IN (
      'business_entitlement_created',
      'business_grandfathered',
      'business_subscription_required',
      'business_subscription_checkout_created',
      'business_subscription_status_synced',
      'business_subscription_webhook_failed'
    )
  );

CREATE TABLE IF NOT EXISTS public.business_subscription_stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  stripe_customer_id text NULL,
  stripe_subscription_id text NULL,
  business_id uuid NULL REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  user_id uuid NULL,
  processing_status text NOT NULL DEFAULT 'processing',
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT business_subscription_stripe_events_event_id_key UNIQUE (stripe_event_id),
  CONSTRAINT business_subscription_stripe_events_status_check CHECK (
    processing_status IN ('processing', 'processed', 'failed', 'ignored')
  )
);

CREATE INDEX IF NOT EXISTS business_subscription_stripe_events_type_received_idx
  ON public.business_subscription_stripe_events (event_type, received_at DESC);

CREATE INDEX IF NOT EXISTS business_subscription_stripe_events_business_received_idx
  ON public.business_subscription_stripe_events (business_id, received_at DESC)
  WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_subscription_stripe_events_customer_idx
  ON public.business_subscription_stripe_events (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_subscription_stripe_events_subscription_idx
  ON public.business_subscription_stripe_events (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_business_subscription_stripe_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_business_subscription_stripe_events_updated_at
ON public.business_subscription_stripe_events;

CREATE TRIGGER set_business_subscription_stripe_events_updated_at
BEFORE UPDATE ON public.business_subscription_stripe_events
FOR EACH ROW
EXECUTE FUNCTION public.set_business_subscription_stripe_events_updated_at();

ALTER TABLE public.business_subscription_stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_subscription_stripe_events_service_all
ON public.business_subscription_stripe_events;

CREATE POLICY business_subscription_stripe_events_service_all
ON public.business_subscription_stripe_events
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.business_subscription_stripe_events TO service_role;
