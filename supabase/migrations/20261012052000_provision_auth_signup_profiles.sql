-- Create canonical Nettmark business/affiliate profiles as part of Auth signup.
-- Do not re-grant broad browser UPDATE on profile role/email/financial fields.
CREATE OR REPLACE FUNCTION public.nettmark_provision_signup_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role text;
  public_name text;
BEGIN
  requested_role := NEW.raw_user_meta_data ->> 'role';
  IF NEW.email IS NULL OR requested_role IS NULL
     OR requested_role NOT IN ('business', 'affiliate') THEN
    RETURN NEW;
  END IF;
  public_name := NULLIF(btrim(NEW.raw_user_meta_data ->> 'username'), '');
  INSERT INTO public.profiles (id, email, role, username)
  VALUES (NEW.id, lower(NEW.email), requested_role, left(public_name, 255))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.nettmark_provision_signup_profile() FROM PUBLIC;
DROP TRIGGER IF EXISTS nettmark_provision_profile_on_signup ON auth.users;
CREATE TRIGGER nettmark_provision_profile_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.nettmark_provision_signup_profile();

-- Recover confirmed and unconfirmed accounts affected by the broken browser upsert.
-- Only rows with recorded original signup role, never overwrite extant profiles.
-- Existing profiles AFTER INSERT triggers create business/affiliate infrastructure,
-- merge pre-signup revenue and enqueue the missed business signup webhook.
INSERT INTO public.profiles (id, email, role, username)
SELECT u.id,
       lower(u.email),
       u.raw_user_meta_data ->> 'role',
       left(NULLIF(btrim(u.raw_user_meta_data ->> 'username'), ''), 255)
FROM auth.users u
WHERE u.email IS NOT NULL
  AND u.raw_user_meta_data ->> 'role' IN ('business','affiliate')
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
