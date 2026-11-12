BEGIN;
DROP TRIGGER IF EXISTS organic_posts_write_guards ON public.organic_posts;
DROP FUNCTION IF EXISTS public.guard_organic_posts_writes();
-- Also drops the constraint from the earlier draft if it was applied.
ALTER TABLE public.organic_posts DROP CONSTRAINT IF EXISTS organic_posts_caption_max_500;
COMMIT;
