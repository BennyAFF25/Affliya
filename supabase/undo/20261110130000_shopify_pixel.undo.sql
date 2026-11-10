-- Manual rollback only. Discards order dedupe history; disable the app pixel first.
-- Existing conversion events/payouts remain. Re-enabling after rollback can duplicate orders.
BEGIN;
DROP FUNCTION IF EXISTS public.record_shopify_conversion(text,text,uuid,uuid,uuid,text,numeric,text,jsonb);
DROP TABLE IF EXISTS public.shopify_order_conversions;
ALTER TABLE public.shopify_stores
  DROP COLUMN IF EXISTS pixel_id,
  DROP COLUMN IF EXISTS pixel_status,
  DROP COLUMN IF EXISTS pixel_error,
  DROP COLUMN IF EXISTS pixel_updated_at;
COMMIT;
