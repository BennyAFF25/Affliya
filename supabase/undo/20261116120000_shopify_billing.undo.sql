-- Stop Shopify billing and reconcile outstanding subscriptions before rollback.
BEGIN;
DROP FUNCTION IF EXISTS public.sync_shopify_billing(uuid,text,jsonb,timestamptz);
DROP FUNCTION IF EXISTS public.claim_shopify_billing(uuid,text);
DROP FUNCTION IF EXISTS public.reserve_stripe_billing(uuid);
ALTER TABLE public.business_entitlements DROP COLUMN IF EXISTS stripe_billing_reserved;
DROP TABLE IF EXISTS public.shopify_app_subscriptions;
ALTER TABLE public.business_entitlements DROP COLUMN IF EXISTS billing_provider;
COMMIT;
