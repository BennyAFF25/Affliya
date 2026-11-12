-- Manual rollback only. Removes all saved Shopify connections; stores must reconnect.
BEGIN;
DROP TABLE IF EXISTS public.shopify_stores;
COMMIT;
