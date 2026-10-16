BEGIN;

ALTER TABLE public.ad_ideas DROP COLUMN IF EXISTS rejected_at;

COMMIT;
