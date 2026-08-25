ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS system_key text;

CREATE UNIQUE INDEX IF NOT EXISTS offers_system_key_unique_idx
  ON public.offers (system_key)
  WHERE system_key IS NOT NULL;

UPDATE public.offers
SET system_key = 'nettmark_partner_programme'
WHERE lower(coalesce(business_email, '')) = 'contact@nettmark.com'
  AND lower(coalesce(title, '')) = 'nettmark partner programme';

UPDATE public.offers
SET recurring_term_months = COALESCE(recurring_term_months, 3),
    payout_cycles = COALESCE(payout_cycles, 3),
    recurring_monthly_commission_value = COALESCE(recurring_monthly_commission_value, commission_value)
WHERE system_key = 'nettmark_partner_programme'
  AND lower(coalesce(type, '')) = 'recurring';

ALTER TABLE public.product_events
  DROP CONSTRAINT IF EXISTS product_events_event_type_check;

ALTER TABLE public.product_events
  ADD CONSTRAINT product_events_event_type_check
  CHECK (event_type IN (
    'content_library_asset_uploaded',
    'content_library_asset_updated',
    'affiliate_brand_content_viewed',
    'affiliate_brand_content_selected',
    'promotion_started',
    'paid_promotion_submitted',
    'organic_promotion_submitted',
    'onboarding_started',
    'promotion_preference_selected',
    'nettmark_partner_offer_activated',
    'first_creative_viewed',
    'first_creative_selected',
    'first_tracking_link_created',
    'first_promotion_ready',
    'onboarding_completed'
  ));
