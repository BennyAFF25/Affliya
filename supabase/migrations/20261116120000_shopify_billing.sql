-- Staging preparation only. Apply before application rollout; no existing rows transformed.
BEGIN;
ALTER TABLE public.business_entitlements ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'stripe'
  CHECK (billing_provider IN ('stripe','shopify'));
ALTER TABLE public.business_entitlements ADD COLUMN IF NOT EXISTS stripe_billing_reserved boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.shopify_app_subscriptions (
  business_id uuid PRIMARY KEY REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  shop_domain text UNIQUE NOT NULL CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  shopify_app_subscription_id text UNIQUE CHECK (shopify_app_subscription_id ~ '^gid://shopify/AppSubscription/[0-9]+$'),
  shopify_plan text NOT NULL DEFAULT 'free' CHECK (shopify_plan IN ('free','growth')),
  status text NOT NULL DEFAULT 'CANCELLED' CHECK (status IN ('ACTIVE','CANCELLED','DECLINED','EXPIRED','FROZEN','PENDING')),
  current_period_end timestamptz,
  trial_end timestamptz,
  trial_used boolean NOT NULL DEFAULT false,
  trial_started_at timestamptz,
  test boolean NOT NULL DEFAULT true,
  confirmation_url text,
  mutation_pending boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL DEFAULT '-infinity',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shopify_app_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopify_app_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shopify_app_subscriptions TO service_role;

-- Serialize provider selection with Stripe's reservation of a subscription customer.
CREATE OR REPLACE FUNCTION public.claim_shopify_billing(p_business uuid, p_shop text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE e public.business_entitlements;
BEGIN
  SELECT * INTO e FROM public.business_entitlements WHERE business_id=p_business FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'entitlement_required'; END IF;
  IF e.stripe_billing_reserved OR e.is_grandfathered OR e.billing_status='grandfathered' OR e.stripe_subscription_id IS NOT NULL
    OR e.subscription_stripe_customer_id IS NOT NULL OR e.subscription_started_at IS NOT NULL
    OR (e.billing_provider='stripe' AND (e.growth_trial_used OR e.growth_trial_started_at IS NOT NULL
      OR e.billing_status NOT IN ('free','subscription_required'))) THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shopify_stores WHERE business_id=p_business AND shop_domain=p_shop AND status='connected') THEN
    RAISE EXCEPTION 'shop_not_owned';
  END IF;
  INSERT INTO public.shopify_app_subscriptions(business_id,shop_domain) VALUES(p_business,p_shop) ON CONFLICT(business_id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.shopify_app_subscriptions WHERE business_id=p_business AND shop_domain=p_shop) THEN
    RAISE EXCEPTION 'billing_shop_conflict';
  END IF;
  UPDATE public.business_entitlements SET billing_provider='shopify' WHERE business_id=p_business;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_stripe_billing(p_business uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e public.business_entitlements;
BEGIN
  SELECT * INTO e FROM public.business_entitlements WHERE business_id=p_business FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF e.billing_provider='shopify' THEN
    IF EXISTS (SELECT 1 FROM public.shopify_stores WHERE business_id=p_business AND status='connected')
      OR EXISTS (SELECT 1 FROM public.shopify_app_subscriptions WHERE business_id=p_business AND status IN ('ACTIVE','FROZEN','PENDING')) THEN RETURN false; END IF;
    UPDATE public.business_entitlements SET billing_provider='stripe', stripe_billing_reserved=true,
      growth_trial_used=e.growth_trial_used OR EXISTS (
        SELECT 1 FROM public.shopify_app_subscriptions WHERE business_id=p_business AND (trial_used OR trial_started_at IS NOT NULL)
      ) WHERE business_id=p_business;
    INSERT INTO public.business_entitlement_events(business_entitlement_id,business_id,business_email,event_type,billing_status,metadata)
      VALUES(e.id,p_business,e.business_email,'business_billing_provider_changed',e.billing_status,
        jsonb_build_object('from','shopify','to','stripe'));
    RETURN true;
  END IF;
  UPDATE public.business_entitlements SET stripe_billing_reserved=true WHERE business_id=p_business;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_stripe_billing(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stripe_billing(uuid) TO service_role;

-- Atomic state + entitlement reconciliation. Older observations cannot undo uninstall/newer queries.
CREATE OR REPLACE FUNCTION public.sync_shopify_billing(p_business uuid, p_shop text, p_state jsonb, p_observed timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e public.business_entitlements; s public.shopify_app_subscriptions; v_status text; v_billing text;
BEGIN
  SELECT * INTO e FROM public.business_entitlements WHERE business_id=p_business FOR UPDATE;
  IF NOT FOUND OR e.billing_provider<>'shopify' THEN RETURN false; END IF;
  SELECT * INTO s FROM public.shopify_app_subscriptions WHERE business_id=p_business AND shop_domain=p_shop FOR UPDATE;
  IF NOT FOUND OR s.observed_at >= p_observed THEN RETURN false; END IF;
  IF p_state->>'id' IS DISTINCT FROM s.shopify_app_subscription_id THEN RAISE EXCEPTION 'subscription_mismatch'; END IF;
  v_status := p_state->>'status';
  v_billing := CASE v_status WHEN 'ACTIVE' THEN CASE WHEN s.trial_end > now() THEN 'subscription_trialing' ELSE 'subscription_active' END
    WHEN 'FROZEN' THEN 'subscription_past_due' WHEN 'PENDING' THEN 'subscription_incomplete'
    WHEN 'CANCELLED' THEN 'subscription_cancelled' WHEN 'DECLINED' THEN 'subscription_cancelled'
    WHEN 'EXPIRED' THEN 'subscription_cancelled' ELSE NULL END;
  IF v_billing IS NULL THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF v_status <> 'CANCELLED' AND NOT EXISTS (
    SELECT 1 FROM public.shopify_stores WHERE business_id=p_business AND shop_domain=p_shop AND status='connected'
  ) THEN RETURN false; END IF;
  -- A repeated observation advances the watermark without rewriting entitlements/audit.
  IF s.status=v_status AND s.current_period_end IS NOT DISTINCT FROM (p_state->>'currentPeriodEnd')::timestamptz
    AND (s.trial_end IS NULL OR v_status<>'ACTIVE' OR s.trial_used)
    AND e.billing_status=CASE WHEN s.shopify_plan='free' THEN 'free' ELSE v_billing END THEN
    UPDATE public.shopify_app_subscriptions SET observed_at=p_observed WHERE business_id=p_business;
    RETURN false;
  END IF;
  UPDATE public.shopify_app_subscriptions SET status=v_status,
    current_period_end=(p_state->>'currentPeriodEnd')::timestamptz, observed_at=p_observed, updated_at=now(),
    trial_used=trial_used OR (v_status='ACTIVE' AND s.trial_end IS NOT NULL),
    trial_started_at=CASE WHEN v_status='ACTIVE' AND s.trial_end IS NOT NULL THEN COALESCE(trial_started_at,now()) ELSE trial_started_at END
    WHERE business_id=p_business;
  UPDATE public.business_entitlements SET billing_status=CASE WHEN s.shopify_plan='free' THEN 'free' ELSE v_billing END,
    subscription_required=NOT (s.shopify_plan='growth' AND v_status='ACTIVE'),
    subscription_current_period_end=(p_state->>'currentPeriodEnd')::timestamptz,
    subscription_cancelled_at=CASE WHEN v_billing='subscription_cancelled' THEN COALESCE(subscription_cancelled_at,now()) ELSE NULL END
    WHERE business_id=p_business AND billing_provider='shopify';
  INSERT INTO public.business_entitlement_events(business_entitlement_id,business_id,business_email,event_type,billing_status,metadata)
    VALUES(e.id,p_business,e.business_email,'business_subscription_status_synced',
      CASE WHEN s.shopify_plan='free' THEN 'free' ELSE v_billing END,
      jsonb_build_object('source','shopify_billing','subscriptionId',s.shopify_app_subscription_id,'status',v_status));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_shopify_billing(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_shopify_billing(uuid,text,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shopify_billing(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_shopify_billing(uuid,text,jsonb,timestamptz) TO service_role;
COMMIT;
