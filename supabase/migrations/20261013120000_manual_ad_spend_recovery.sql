-- Manual recovery of an already-stopped paid ad is server-only and one-shot per live ad.
-- No browser-facing role may read or mutate recovery records directly.
CREATE TABLE IF NOT EXISTS public.manual_ad_spend_recoveries (
  live_ad_id uuid PRIMARY KEY REFERENCES public.live_ads(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.business_profiles(id),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  verified_meta_spend numeric(12,2) NOT NULL CHECK (verified_meta_spend >= 0),
  transferred_before numeric(12,2) NOT NULL CHECK (transferred_before >= 0),
  status text NOT NULL CHECK (status IN ('claimed','completed','partial','failed')),
  charged_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (charged_amount >= 0),
  settlement_id uuid NULL REFERENCES public.ad_spend_settlements(id),
  error_code text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

ALTER TABLE public.manual_ad_spend_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_ad_spend_recoveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.manual_ad_spend_recoveries TO service_role;

-- An affiliate may legitimately pause their ad using approved controls,
-- but must never be able to forge the financial settlement watermark or
-- change the Meta/owner linkage that manual recovery verifies.
CREATE OR REPLACE FUNCTION public.protect_live_ad_settlement_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
    NEW.spend IS DISTINCT FROM OLD.spend OR
    NEW.spend_transferred IS DISTINCT FROM OLD.spend_transferred OR
    NEW.business_email IS DISTINCT FROM OLD.business_email OR
    NEW.affiliate_email IS DISTINCT FROM OLD.affiliate_email OR
    NEW.business_id IS DISTINCT FROM OLD.business_id OR
    NEW.affiliate_user_id IS DISTINCT FROM OLD.affiliate_user_id OR
    NEW.offer_id IS DISTINCT FROM OLD.offer_id OR
    NEW.ad_idea_id IS DISTINCT FROM OLD.ad_idea_id OR
    NEW.meta_ad_id IS DISTINCT FROM OLD.meta_ad_id OR
    NEW.meta_campaign_id IS DISTINCT FROM OLD.meta_campaign_id OR
    NEW.ad_set_id IS DISTINCT FROM OLD.ad_set_id
  ) THEN
    RAISE EXCEPTION 'Live ad financial and ownership fields are server-managed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_live_ad_settlement_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_live_ad_settlement_fields_trigger ON public.live_ads;
CREATE TRIGGER protect_live_ad_settlement_fields_trigger
BEFORE UPDATE ON public.live_ads
FOR EACH ROW EXECUTE FUNCTION public.protect_live_ad_settlement_fields();

-- Paid live ads are created by the server-side launch handler using the
-- service-role client, never directly by a browser. Existing permissive INSERT
-- RLS would otherwise allow a user to forge rows for recovery attempts.
REVOKE INSERT ON public.live_ads FROM PUBLIC, anon, authenticated;

-- Recovery also independently cross-checks each row against a genuine
-- approved ad idea and the owning Meta ad account before any wallet charge.
