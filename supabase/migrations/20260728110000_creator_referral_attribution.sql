-- Rollout 4: Creator referral attribution + commission eligibility ledger
-- Records attribution and calculates commission eligibility only. No automatic payouts.

CREATE TABLE IF NOT EXISTS public.creator_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  partner_email text NULL,
  referral_code text NOT NULL,
  referral_url text NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  commission_percentage numeric(5,2) NOT NULL DEFAULT 50.00,
  commission_duration_months integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_partners_status_check CHECK (status IN ('invited', 'active', 'paused', 'terminated')),
  CONSTRAINT creator_partners_commission_percentage_check CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  CONSTRAINT creator_partners_commission_duration_check CHECK (commission_duration_months >= 0 AND commission_duration_months <= 36),
  CONSTRAINT creator_partners_referral_code_format_check CHECK (referral_code ~ '^[A-Za-z0-9_-]{3,64}$'),
  CONSTRAINT creator_partners_partner_email_key UNIQUE (partner_email)
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_partners_referral_code_lower_key
  ON public.creator_partners (lower(referral_code));

CREATE INDEX IF NOT EXISTS creator_partners_status_idx
  ON public.creator_partners (status);

CREATE TABLE IF NOT EXISTS public.creator_referral_signup_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_partner_id uuid NOT NULL REFERENCES public.creator_partners(id) ON DELETE RESTRICT,
  referral_code text NOT NULL,
  business_email text NOT NULL,
  user_id uuid NULL,
  attribution_source text NOT NULL DEFAULT 'landing_referral_cookie',
  landing_session_id text NULL,
  landing_path text NULL,
  landing_referrer text NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_referral_signup_intents_business_email_key UNIQUE (business_email)
);

CREATE INDEX IF NOT EXISTS creator_referral_signup_intents_partner_idx
  ON public.creator_referral_signup_intents (creator_partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.business_creator_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  business_email text NOT NULL,
  creator_partner_id uuid NOT NULL REFERENCES public.creator_partners(id) ON DELETE RESTRICT,
  referral_code text NOT NULL,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  attribution_source text NOT NULL,
  landing_session_id text NULL,
  first_subscription_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_creator_attributions_business_id_key UNIQUE (business_id),
  CONSTRAINT business_creator_attributions_business_email_key UNIQUE (business_email)
);

CREATE INDEX IF NOT EXISTS business_creator_attributions_partner_idx
  ON public.business_creator_attributions (creator_partner_id, attributed_at DESC);

CREATE INDEX IF NOT EXISTS business_creator_attributions_subscription_idx
  ON public.business_creator_attributions (first_subscription_id)
  WHERE first_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.creator_commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_partner_id uuid NOT NULL REFERENCES public.creator_partners(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  business_creator_attribution_id uuid NOT NULL REFERENCES public.business_creator_attributions(id) ON DELETE RESTRICT,
  stripe_invoice_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  gross_eligible_subscription_amount integer NOT NULL,
  commission_percentage numeric(5,2) NOT NULL,
  commission_amount integer NOT NULL,
  currency text NOT NULL,
  commission_month_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  eligibility_date timestamptz NOT NULL,
  reversal_reason text NULL,
  reversed_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creator_commission_ledger_status_check CHECK (status IN ('pending', 'payable', 'paid', 'reversed', 'rejected')),
  CONSTRAINT creator_commission_ledger_month_check CHECK (commission_month_number >= 1 AND commission_month_number <= 36),
  CONSTRAINT creator_commission_ledger_amount_check CHECK (gross_eligible_subscription_amount >= 0 AND commission_amount >= 0),
  CONSTRAINT creator_commission_ledger_currency_check CHECK (currency = lower(currency) AND char_length(currency) BETWEEN 3 AND 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_commission_ledger_invoice_key
  ON public.creator_commission_ledger (stripe_invoice_id);

CREATE INDEX IF NOT EXISTS creator_commission_ledger_partner_status_idx
  ON public.creator_commission_ledger (creator_partner_id, status, eligibility_date DESC);

CREATE INDEX IF NOT EXISTS creator_commission_ledger_business_idx
  ON public.creator_commission_ledger (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creator_commission_ledger_subscription_idx
  ON public.creator_commission_ledger (stripe_subscription_id, commission_month_number);

CREATE OR REPLACE FUNCTION public.set_creator_referral_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_creator_partners_updated_at ON public.creator_partners;
CREATE TRIGGER set_creator_partners_updated_at
BEFORE UPDATE ON public.creator_partners
FOR EACH ROW EXECUTE FUNCTION public.set_creator_referral_updated_at();

DROP TRIGGER IF EXISTS set_creator_referral_signup_intents_updated_at ON public.creator_referral_signup_intents;
CREATE TRIGGER set_creator_referral_signup_intents_updated_at
BEFORE UPDATE ON public.creator_referral_signup_intents
FOR EACH ROW EXECUTE FUNCTION public.set_creator_referral_updated_at();

DROP TRIGGER IF EXISTS set_business_creator_attributions_updated_at ON public.business_creator_attributions;
CREATE TRIGGER set_business_creator_attributions_updated_at
BEFORE UPDATE ON public.business_creator_attributions
FOR EACH ROW EXECUTE FUNCTION public.set_creator_referral_updated_at();

DROP TRIGGER IF EXISTS set_creator_commission_ledger_updated_at ON public.creator_commission_ledger;
CREATE TRIGGER set_creator_commission_ledger_updated_at
BEFORE UPDATE ON public.creator_commission_ledger
FOR EACH ROW EXECUTE FUNCTION public.set_creator_referral_updated_at();

CREATE OR REPLACE FUNCTION public.attach_creator_referral_attribution(
  p_business_id uuid,
  p_business_email text,
  p_attribution_source text DEFAULT 'business_profile_insert'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.creator_referral_signup_intents%ROWTYPE;
  v_attribution_id uuid;
  v_is_grandfathered boolean;
BEGIN
  IF p_business_id IS NULL OR p_business_email IS NULL OR btrim(p_business_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(be.is_grandfathered, false)
  INTO v_is_grandfathered
  FROM public.business_entitlements be
  WHERE be.business_id = p_business_id
     OR lower(be.business_email) = lower(p_business_email)
  LIMIT 1;

  IF COALESCE(v_is_grandfathered, false) THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_intent
  FROM public.creator_referral_signup_intents i
  WHERE lower(i.business_email) = lower(p_business_email)
    AND i.consumed_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.business_creator_attributions (
    business_id,
    business_email,
    creator_partner_id,
    referral_code,
    attributed_at,
    attribution_source,
    landing_session_id,
    metadata
  ) VALUES (
    p_business_id,
    p_business_email,
    v_intent.creator_partner_id,
    v_intent.referral_code,
    now(),
    COALESCE(p_attribution_source, v_intent.attribution_source),
    v_intent.landing_session_id,
    jsonb_build_object(
      'signupIntentId', v_intent.id,
      'landingPath', v_intent.landing_path,
      'landingReferrer', v_intent.landing_referrer,
      'userId', v_intent.user_id
    )
  )
  ON CONFLICT (business_id) DO NOTHING
  RETURNING id INTO v_attribution_id;

  IF v_attribution_id IS NOT NULL THEN
    UPDATE public.creator_referral_signup_intents
    SET consumed_at = now(), updated_at = now()
    WHERE id = v_intent.id;
  ELSE
    SELECT id INTO v_attribution_id
    FROM public.business_creator_attributions
    WHERE business_id = p_business_id;
  END IF;

  RETURN v_attribution_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_creator_referral_attribution_on_business_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.attach_creator_referral_attribution(
    NEW.id,
    NEW.business_email,
    'business_profile_insert'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attach_creator_referral_attribution_on_business_profile_insert
ON public.business_profiles;
CREATE TRIGGER attach_creator_referral_attribution_on_business_profile_insert
AFTER INSERT ON public.business_profiles
FOR EACH ROW EXECUTE FUNCTION public.attach_creator_referral_attribution_on_business_profile();

ALTER TABLE public.creator_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_referral_signup_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_creator_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_partners_service_all ON public.creator_partners;
CREATE POLICY creator_partners_service_all
ON public.creator_partners
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS creator_referral_signup_intents_service_all ON public.creator_referral_signup_intents;
CREATE POLICY creator_referral_signup_intents_service_all
ON public.creator_referral_signup_intents
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS business_creator_attributions_service_all ON public.business_creator_attributions;
CREATE POLICY business_creator_attributions_service_all
ON public.business_creator_attributions
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS creator_commission_ledger_service_all ON public.creator_commission_ledger;
CREATE POLICY creator_commission_ledger_service_all
ON public.creator_commission_ledger
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.creator_partners TO authenticated;
GRANT ALL ON public.creator_partners TO service_role;
GRANT ALL ON public.creator_referral_signup_intents TO service_role;
GRANT ALL ON public.business_creator_attributions TO service_role;
GRANT ALL ON public.creator_commission_ledger TO service_role;
