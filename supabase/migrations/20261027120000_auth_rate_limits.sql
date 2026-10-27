BEGIN;
CREATE TABLE public.auth_rate_limits (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits int NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_rate_limits FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.auth_rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE allowed boolean;
BEGIN
  IF p_bucket IS NULL OR p_limit <= 0 OR p_limit > 1000000 OR p_window_seconds <= 0 OR p_limit IS NULL OR p_window_seconds IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.auth_rate_limits AS limits (bucket, window_start, hits, updated_at)
  VALUES (p_bucket, now(), 1, now())
  ON CONFLICT (bucket) DO UPDATE SET
    window_start = CASE WHEN limits.window_start <= now() - make_interval(secs => p_window_seconds) THEN now() ELSE limits.window_start END,
    hits = CASE WHEN limits.window_start <= now() - make_interval(secs => p_window_seconds) THEN 1 ELSE LEAST(limits.hits::bigint + 1, p_limit::bigint + 1)::int END,
    updated_at = now()
  RETURNING hits <= p_limit INTO allowed;
  RETURN allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.auth_rate_limit_hit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_hit(text, int, int) TO service_role;
COMMIT;
