-- Manual rollback only: export/reconcile programme financial history first.
-- Cannot recover deleted programme metadata; restores pre-programme schema/functions.
BEGIN;
DROP FUNCTION IF EXISTS public.growth_partner_auth_user_id(text);
DROP FUNCTION IF EXISTS public.approve_growth_partner_application(uuid,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.create_creator_subscription_commission(uuid,text,text,integer,integer,integer,text,timestamptz,integer);
DROP FUNCTION IF EXISTS public.refund_creator_subscription_commission(text,text,integer,text);
DROP FUNCTION IF EXISTS public.review_creator_commission(uuid,boolean,text,text);
DROP FUNCTION IF EXISTS public.record_creator_partner_payout(uuid,uuid[],text,text,text,text);
DROP TABLE IF EXISTS public.creator_referral_events;
ALTER TABLE public.creator_partners DROP CONSTRAINT IF EXISTS creator_partners_application_id_fkey;
ALTER TABLE public.creator_partners DROP COLUMN IF EXISTS application_id;
DROP TABLE IF EXISTS public.growth_partner_applications;
-- Clawbacks cannot exist in the original schema. Preserve/export before undo.
DELETE FROM public.creator_commission_ledger WHERE entry_type='clawback';
DROP INDEX IF EXISTS public.creator_commission_ledger_refund_key;
DROP INDEX IF EXISTS public.creator_commission_ledger_invoice_key;
ALTER TABLE public.creator_commission_ledger DROP CONSTRAINT IF EXISTS creator_commission_ledger_amount_check;
ALTER TABLE public.creator_commission_ledger DROP CONSTRAINT IF EXISTS creator_commission_ledger_status_check;
UPDATE public.creator_commission_ledger SET status='payable' WHERE status='approved';
ALTER TABLE public.creator_commission_ledger ADD CONSTRAINT creator_commission_ledger_status_check CHECK (status IN ('pending','payable','paid','reversed','rejected'));
ALTER TABLE public.creator_commission_ledger ADD CONSTRAINT creator_commission_ledger_amount_check CHECK (gross_eligible_subscription_amount>=0 AND commission_amount>=0);
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS entry_type;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS revenue_type;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS amount_paid;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS tax_amount;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS refunded_amount;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS original_ledger_id;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS stripe_refund_id;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS approvable_at;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS approved_at;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS approved_by_email;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS paid_at;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS payout_id;
CREATE UNIQUE INDEX IF NOT EXISTS creator_commission_ledger_invoice_key ON public.creator_commission_ledger(stripe_invoice_id);
DROP TABLE IF EXISTS public.creator_partner_payouts;
ALTER TABLE public.business_creator_attributions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.business_creator_attributions DROP COLUMN IF EXISTS first_trial_started_at;
ALTER TABLE public.business_creator_attributions DROP COLUMN IF EXISTS first_paid_at;
ALTER TABLE public.business_creator_attributions DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE public.creator_referral_signup_intents DROP COLUMN IF EXISTS captured_at;
ALTER TABLE public.creator_partners DROP CONSTRAINT IF EXISTS creator_partners_status_check;
UPDATE public.creator_partners SET status='paused' WHERE status='suspended';
ALTER TABLE public.creator_partners ADD CONSTRAINT creator_partners_status_check CHECK (status IN ('invited','active','paused','terminated'));
ALTER TABLE public.creator_partners DROP COLUMN IF EXISTS program;
ALTER TABLE public.creator_partners DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.creator_partners DROP COLUMN IF EXISTS approved_at;
ALTER TABLE public.creator_partners DROP COLUMN IF EXISTS approved_by_email;
ALTER TABLE public.creator_partners DROP COLUMN IF EXISTS suspended_at;
ALTER TABLE public.creator_partners DROP COLUMN IF EXISTS suspension_reason;
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

REVOKE ALL ON FUNCTION public.attach_creator_referral_attribution(uuid,text,text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.attach_creator_referral_attribution(uuid,text,text) TO PUBLIC;
COMMIT;
