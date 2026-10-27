BEGIN;
DROP FUNCTION IF EXISTS public.auth_rate_limit_hit(text, int, int);
DROP TABLE IF EXISTS public.auth_rate_limits;
COMMIT;
