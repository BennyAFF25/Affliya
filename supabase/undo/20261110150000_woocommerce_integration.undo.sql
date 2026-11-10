-- Manual only. Disconnect stores first to delete remote webhooks. Drops order attribution records;
-- existing canonical events and payouts remain untouched. Back up before applying.
BEGIN;
DROP FUNCTION IF EXISTS public.woocommerce_offer_connected(uuid);
DROP FUNCTION IF EXISTS public.record_woocommerce_conversion(uuid,text,uuid,uuid,uuid,text,numeric,text,jsonb);
DROP TABLE IF EXISTS public.woocommerce_order_conversions;
DROP TABLE IF EXISTS public.woocommerce_stores;
COMMIT;
