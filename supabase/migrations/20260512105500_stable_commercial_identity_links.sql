ALTER TABLE public.wallet_payouts
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid REFERENCES public.affiliate_profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.wallet_deductions
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid REFERENCES public.affiliate_profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.wallet_topups
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid REFERENCES public.affiliate_profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.wallet_refunds
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid REFERENCES public.affiliate_profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.live_ads
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid REFERENCES public.affiliate_profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.live_campaigns
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid REFERENCES public.affiliate_profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.campaign_tracking_events
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid REFERENCES public.affiliate_profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wallet_payouts_business_id_idx ON public.wallet_payouts (business_id);
CREATE INDEX IF NOT EXISTS wallet_payouts_affiliate_user_id_idx ON public.wallet_payouts (affiliate_user_id);
CREATE INDEX IF NOT EXISTS wallet_deductions_business_id_idx ON public.wallet_deductions (business_id);
CREATE INDEX IF NOT EXISTS wallet_deductions_affiliate_user_id_idx ON public.wallet_deductions (affiliate_user_id);
CREATE INDEX IF NOT EXISTS wallet_topups_affiliate_user_id_idx ON public.wallet_topups (affiliate_user_id);
CREATE INDEX IF NOT EXISTS wallet_refunds_affiliate_user_id_idx ON public.wallet_refunds (affiliate_user_id);
CREATE INDEX IF NOT EXISTS live_ads_business_id_idx ON public.live_ads (business_id);
CREATE INDEX IF NOT EXISTS live_ads_affiliate_user_id_idx ON public.live_ads (affiliate_user_id);
CREATE INDEX IF NOT EXISTS live_campaigns_business_id_idx ON public.live_campaigns (business_id);
CREATE INDEX IF NOT EXISTS live_campaigns_affiliate_user_id_idx ON public.live_campaigns (affiliate_user_id);
CREATE INDEX IF NOT EXISTS campaign_tracking_events_business_id_idx ON public.campaign_tracking_events (business_id);
CREATE INDEX IF NOT EXISTS campaign_tracking_events_affiliate_user_id_idx ON public.campaign_tracking_events (affiliate_user_id);

CREATE OR REPLACE FUNCTION public.resolve_commercial_identity_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id uuid;
  v_affiliate_user_id uuid;
BEGIN
  IF TG_TABLE_NAME IN ('wallet_payouts', 'wallet_deductions', 'live_ads', 'live_campaigns') THEN
    IF NEW.business_id IS NULL AND NEW.business_email IS NOT NULL THEN
      SELECT bp.id INTO v_business_id
      FROM public.business_profiles bp
      WHERE bp.business_email = NEW.business_email
      LIMIT 1;

      NEW.business_id := v_business_id;
    END IF;
  END IF;

  IF TG_TABLE_NAME IN ('wallet_payouts', 'wallet_deductions', 'wallet_topups', 'wallet_refunds', 'live_ads', 'live_campaigns') THEN
    IF NEW.affiliate_user_id IS NULL AND NEW.affiliate_email IS NOT NULL THEN
      SELECT ap.user_id INTO v_affiliate_user_id
      FROM public.affiliate_profiles ap
      WHERE ap.email = NEW.affiliate_email
      LIMIT 1;

      NEW.affiliate_user_id := v_affiliate_user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'campaign_tracking_events' THEN
    IF NEW.affiliate_user_id IS NULL AND NEW.affiliate_id IS NOT NULL THEN
      SELECT ap.user_id INTO v_affiliate_user_id
      FROM public.affiliate_profiles ap
      WHERE ap.email = NEW.affiliate_id
      LIMIT 1;

      NEW.affiliate_user_id := v_affiliate_user_id;
    END IF;

    IF NEW.business_id IS NULL THEN
      IF NEW.campaign_id IS NOT NULL THEN
        SELECT bp.id INTO v_business_id
        FROM public.live_ads la
        JOIN public.business_profiles bp ON bp.business_email = la.business_email
        WHERE la.id = NEW.campaign_id
        LIMIT 1;

        IF v_business_id IS NULL THEN
          SELECT bp.id INTO v_business_id
          FROM public.live_campaigns lc
          JOIN public.business_profiles bp ON bp.business_email = lc.business_email
          WHERE lc.id = NEW.campaign_id
          LIMIT 1;
        END IF;
      END IF;

      IF v_business_id IS NULL AND NEW.offer_id IS NOT NULL THEN
        SELECT bp.id INTO v_business_id
        FROM public.offers o
        JOIN public.business_profiles bp ON bp.business_email = o.business_email
        WHERE o.id = NEW.offer_id
        LIMIT 1;
      END IF;

      NEW.business_id := v_business_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_wallet_payouts_identity_links ON public.wallet_payouts;
CREATE TRIGGER resolve_wallet_payouts_identity_links
BEFORE INSERT OR UPDATE ON public.wallet_payouts
FOR EACH ROW EXECUTE FUNCTION public.resolve_commercial_identity_links();

DROP TRIGGER IF EXISTS resolve_wallet_deductions_identity_links ON public.wallet_deductions;
CREATE TRIGGER resolve_wallet_deductions_identity_links
BEFORE INSERT OR UPDATE ON public.wallet_deductions
FOR EACH ROW EXECUTE FUNCTION public.resolve_commercial_identity_links();

DROP TRIGGER IF EXISTS resolve_wallet_topups_identity_links ON public.wallet_topups;
CREATE TRIGGER resolve_wallet_topups_identity_links
BEFORE INSERT OR UPDATE ON public.wallet_topups
FOR EACH ROW EXECUTE FUNCTION public.resolve_commercial_identity_links();

DROP TRIGGER IF EXISTS resolve_wallet_refunds_identity_links ON public.wallet_refunds;
CREATE TRIGGER resolve_wallet_refunds_identity_links
BEFORE INSERT OR UPDATE ON public.wallet_refunds
FOR EACH ROW EXECUTE FUNCTION public.resolve_commercial_identity_links();

DROP TRIGGER IF EXISTS resolve_live_ads_identity_links ON public.live_ads;
CREATE TRIGGER resolve_live_ads_identity_links
BEFORE INSERT OR UPDATE ON public.live_ads
FOR EACH ROW EXECUTE FUNCTION public.resolve_commercial_identity_links();

DROP TRIGGER IF EXISTS resolve_live_campaigns_identity_links ON public.live_campaigns;
CREATE TRIGGER resolve_live_campaigns_identity_links
BEFORE INSERT OR UPDATE ON public.live_campaigns
FOR EACH ROW EXECUTE FUNCTION public.resolve_commercial_identity_links();

DROP TRIGGER IF EXISTS resolve_campaign_tracking_events_identity_links ON public.campaign_tracking_events;
CREATE TRIGGER resolve_campaign_tracking_events_identity_links
BEFORE INSERT OR UPDATE ON public.campaign_tracking_events
FOR EACH ROW EXECUTE FUNCTION public.resolve_commercial_identity_links();

UPDATE public.wallet_payouts wp
SET business_id = bp.id
FROM public.business_profiles bp
WHERE wp.business_id IS NULL
  AND wp.business_email = bp.business_email;

UPDATE public.wallet_payouts wp
SET affiliate_user_id = ap.user_id
FROM public.affiliate_profiles ap
WHERE wp.affiliate_user_id IS NULL
  AND wp.affiliate_email = ap.email;

UPDATE public.wallet_deductions wd
SET business_id = bp.id
FROM public.business_profiles bp
WHERE wd.business_id IS NULL
  AND wd.business_email = bp.business_email;

UPDATE public.wallet_deductions wd
SET affiliate_user_id = ap.user_id
FROM public.affiliate_profiles ap
WHERE wd.affiliate_user_id IS NULL
  AND wd.affiliate_email = ap.email;

UPDATE public.wallet_topups wt
SET affiliate_user_id = ap.user_id
FROM public.affiliate_profiles ap
WHERE wt.affiliate_user_id IS NULL
  AND wt.affiliate_email = ap.email;

UPDATE public.wallet_refunds wr
SET affiliate_user_id = ap.user_id
FROM public.affiliate_profiles ap
WHERE wr.affiliate_user_id IS NULL
  AND wr.affiliate_email = ap.email;

UPDATE public.live_ads la
SET business_id = bp.id
FROM public.business_profiles bp
WHERE la.business_id IS NULL
  AND la.business_email = bp.business_email;

UPDATE public.live_ads la
SET affiliate_user_id = ap.user_id
FROM public.affiliate_profiles ap
WHERE la.affiliate_user_id IS NULL
  AND la.affiliate_email = ap.email;

UPDATE public.live_campaigns lc
SET business_id = bp.id
FROM public.business_profiles bp
WHERE lc.business_id IS NULL
  AND lc.business_email = bp.business_email;

UPDATE public.live_campaigns lc
SET affiliate_user_id = ap.user_id
FROM public.affiliate_profiles ap
WHERE lc.affiliate_user_id IS NULL
  AND lc.affiliate_email = ap.email;

UPDATE public.campaign_tracking_events cte
SET affiliate_user_id = ap.user_id
FROM public.affiliate_profiles ap
WHERE cte.affiliate_user_id IS NULL
  AND cte.affiliate_id = ap.email;

UPDATE public.campaign_tracking_events cte
SET business_id = resolved.business_id
FROM (
  SELECT c.id AS event_id, bp.id AS business_id
  FROM public.campaign_tracking_events c
  JOIN public.live_ads la ON la.id = c.campaign_id
  JOIN public.business_profiles bp ON bp.business_email = la.business_email
) resolved
WHERE cte.id = resolved.event_id
  AND cte.business_id IS NULL;

UPDATE public.campaign_tracking_events cte
SET business_id = resolved.business_id
FROM (
  SELECT c.id AS event_id, bp.id AS business_id
  FROM public.campaign_tracking_events c
  JOIN public.live_campaigns lc ON lc.id = c.campaign_id
  JOIN public.business_profiles bp ON bp.business_email = lc.business_email
) resolved
WHERE cte.id = resolved.event_id
  AND cte.business_id IS NULL;

UPDATE public.campaign_tracking_events cte
SET business_id = resolved.business_id
FROM (
  SELECT c.id AS event_id, bp.id AS business_id
  FROM public.campaign_tracking_events c
  JOIN public.offers o ON o.id = c.offer_id
  JOIN public.business_profiles bp ON bp.business_email = o.business_email
) resolved
WHERE cte.id = resolved.event_id
  AND cte.business_id IS NULL;