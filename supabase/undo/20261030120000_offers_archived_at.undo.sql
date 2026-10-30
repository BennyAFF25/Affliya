BEGIN;
DROP FUNCTION IF EXISTS public.delete_business_offer(uuid);
ALTER TABLE public.offers DROP COLUMN IF EXISTS archived_reason, DROP COLUMN IF EXISTS archived_at;
COMMIT;
