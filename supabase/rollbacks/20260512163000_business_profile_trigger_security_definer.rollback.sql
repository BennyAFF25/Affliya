CREATE OR REPLACE FUNCTION public.ensure_business_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'business' THEN
    INSERT INTO public.business_profiles (id, business_email, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
      SET business_email = EXCLUDED.business_email,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;
