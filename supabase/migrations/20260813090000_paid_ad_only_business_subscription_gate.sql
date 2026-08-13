-- Narrow Nettmark Business subscription gate to the paid-ad affiliate ad idea flow only.
-- Everything remains free/normal until a business approves an affiliate-submitted paid ad idea
-- or a paid Meta live_ad is inserted from that approved idea.

CREATE OR REPLACE FUNCTION public.enforce_business_subscription_for_campaign_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_business_email text;
BEGIN
  IF NOT public.is_business_subscription_gate_enabled() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'ad_ideas' THEN
    IF TG_OP = 'UPDATE'
      AND COALESCE(OLD.status, '') IS DISTINCT FROM COALESCE(NEW.status, '')
      AND LOWER(COALESCE(NEW.status, '')) = 'approved'
    THEN
      v_business_id := NULL;
      v_business_email := NEW.business_email;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'live_ads' THEN
    IF TG_OP = 'INSERT' THEN
      v_business_id := NEW.business_id;
      v_business_email := NEW.business_email;
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
    RAISE EXCEPTION 'BUSINESS_SUBSCRIPTION_REQUIRED: Activate Nettmark Business to approve and launch paid affiliate ad campaigns.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_business_subscription_affiliate_requests
ON public.affiliate_requests;

DROP TRIGGER IF EXISTS enforce_business_subscription_live_campaigns
ON public.live_campaigns;

DROP TRIGGER IF EXISTS enforce_business_subscription_ad_ideas
ON public.ad_ideas;
CREATE TRIGGER enforce_business_subscription_ad_ideas
BEFORE UPDATE ON public.ad_ideas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_subscription_for_campaign_activation();

DROP TRIGGER IF EXISTS enforce_business_subscription_live_ads
ON public.live_ads;
CREATE TRIGGER enforce_business_subscription_live_ads
BEFORE INSERT ON public.live_ads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_subscription_for_campaign_activation();
