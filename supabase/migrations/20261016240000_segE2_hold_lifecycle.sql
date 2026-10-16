BEGIN;
CREATE OR REPLACE FUNCTION public.segA_hold_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'wallet_deductions' THEN
    BEGIN PERFORM public.consume_launch_hold(NEW.id::text);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Launch hold consumption failed for deduction %: %', NEW.id, SQLERRM; END;
  ELSIF TG_TABLE_NAME = 'ad_ideas' THEN
    IF NEW.status = 'rejected' THEN PERFORM public.release_launch_hold('ad_ideas',NEW.id::text); END IF;
  ELSE
    IF lower(NEW.status) IN ('stopped','archived','rejected','deleted','completed','ended')
      AND coalesce(NEW.spend,0) <= coalesce(NEW.spend_transferred,0) THEN
      PERFORM public.release_launch_hold('ad_ideas',NEW.ad_idea_id::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
