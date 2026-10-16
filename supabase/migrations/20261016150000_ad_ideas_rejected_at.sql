BEGIN;

ALTER TABLE public.ad_ideas ADD COLUMN IF NOT EXISTS rejected_at timestamptz NULL;
COMMENT ON COLUMN public.ad_ideas.rejected_at IS 'Time the business rejected this proposal; NULL for historical rejections without a recorded decision time.';

COMMIT;
