DROP TRIGGER IF EXISTS resolve_campaign_tracking_events_identity_links ON public.campaign_tracking_events;
DROP TRIGGER IF EXISTS resolve_live_campaigns_identity_links ON public.live_campaigns;
DROP TRIGGER IF EXISTS resolve_live_ads_identity_links ON public.live_ads;
DROP TRIGGER IF EXISTS resolve_wallet_refunds_identity_links ON public.wallet_refunds;
DROP TRIGGER IF EXISTS resolve_wallet_topups_identity_links ON public.wallet_topups;
DROP TRIGGER IF EXISTS resolve_wallet_deductions_identity_links ON public.wallet_deductions;
DROP TRIGGER IF EXISTS resolve_wallet_payouts_identity_links ON public.wallet_payouts;

DROP FUNCTION IF EXISTS public.resolve_commercial_identity_links();

DROP INDEX IF EXISTS campaign_tracking_events_affiliate_user_id_idx;
DROP INDEX IF EXISTS campaign_tracking_events_business_id_idx;
DROP INDEX IF EXISTS live_campaigns_affiliate_user_id_idx;
DROP INDEX IF EXISTS live_campaigns_business_id_idx;
DROP INDEX IF EXISTS live_ads_affiliate_user_id_idx;
DROP INDEX IF EXISTS live_ads_business_id_idx;
DROP INDEX IF EXISTS wallet_refunds_affiliate_user_id_idx;
DROP INDEX IF EXISTS wallet_topups_affiliate_user_id_idx;
DROP INDEX IF EXISTS wallet_deductions_affiliate_user_id_idx;
DROP INDEX IF EXISTS wallet_deductions_business_id_idx;
DROP INDEX IF EXISTS wallet_payouts_affiliate_user_id_idx;
DROP INDEX IF EXISTS wallet_payouts_business_id_idx;

ALTER TABLE public.campaign_tracking_events
  DROP COLUMN IF EXISTS affiliate_user_id,
  DROP COLUMN IF EXISTS business_id;

ALTER TABLE public.live_campaigns
  DROP COLUMN IF EXISTS affiliate_user_id,
  DROP COLUMN IF EXISTS business_id;

ALTER TABLE public.live_ads
  DROP COLUMN IF EXISTS affiliate_user_id,
  DROP COLUMN IF EXISTS business_id;

ALTER TABLE public.wallet_refunds
  DROP COLUMN IF EXISTS affiliate_user_id;

ALTER TABLE public.wallet_topups
  DROP COLUMN IF EXISTS affiliate_user_id;

ALTER TABLE public.wallet_deductions
  DROP COLUMN IF EXISTS affiliate_user_id,
  DROP COLUMN IF EXISTS business_id;

ALTER TABLE public.wallet_payouts
  DROP COLUMN IF EXISTS affiliate_user_id,
  DROP COLUMN IF EXISTS business_id;