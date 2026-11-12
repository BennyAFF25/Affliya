BEGIN;

-- Production has 16 existing captions over 500 characters (none NULL). A CHECK constraint,
-- even NOT VALID, is re-evaluated on every UPDATE of those rows, which would stop a business
-- from rejecting a grandfathered post. So the limit is enforced in the trigger instead: on
-- INSERT, and on UPDATE only when the caption itself changes. Applies to every role.
-- JS String.length counts UTF-16 units, SQL char_length counts codepoints; server
-- validation stays the stricter limit.

CREATE FUNCTION public.guard_organic_posts_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.caption IS NOT NULL AND char_length(NEW.caption) > 500
     AND (TG_OP = 'INSERT' OR NEW.caption IS DISTINCT FROM OLD.caption) THEN
    RAISE EXCEPTION 'Organic captions are limited to 500 characters.' USING ERRCODE = '23514';
  END IF;
  -- Only the database role decides: PostgREST switches to service_role for the service key.
  -- JWT claim settings are not trusted here because a session could set them itself.
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF NEW.status = 'approved' THEN
      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Organic post approval requires the server approval route.' USING ERRCODE = '42501';
      ELSIF OLD.status IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'Organic post approval requires the server approval route.' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id THEN
        RAISE EXCEPTION 'Organic campaign links can only be changed by the server.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  -- Existing RLS still controls business pending/rejected updates and affiliate INSERT.
  RETURN NEW;
END;
$$;

CREATE TRIGGER organic_posts_write_guards
  BEFORE INSERT OR UPDATE ON public.organic_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_organic_posts_writes();

COMMIT;
