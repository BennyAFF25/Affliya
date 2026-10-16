-- MANUAL ONLY. Requires disposable DB with prior migrations and Segment C applied.
-- Never run against production. All fixture/cache changes roll back.
BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.fx_rates(base,rate,rate_date,source)
VALUES('USD',1.5,current_date,'frankfurter');
INSERT INTO public.fx_rates(base,rate,rate_date,source)
VALUES('USD',1.51,current_date,'frankfurter')
ON CONFLICT(base,quote,rate_date,source) DO UPDATE SET rate=excluded.rate;
DO $$
BEGIN
  IF (SELECT rate FROM public.fx_rates WHERE base='USD' AND quote='AUD'
    AND rate_date=current_date AND source='frankfurter') <> 1.51 THEN
    RAISE EXCEPTION 'FX upsert failed';
  END IF;
  BEGIN
    INSERT INTO public.fx_rates(base,rate,rate_date,source) VALUES('USD',0,current_date,'invalid');
    RAISE EXCEPTION 'Expected positive-rate constraint';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.reserve_launch_hold_fx('segc@example.test',156,'missing-idea',100,'USD',1.5,'frankfurter',current_date,400);
    RAISE EXCEPTION 'Expected missing proposal rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Launch proposal not found' THEN RAISE; END IF;
  END;
  IF has_table_privilege('anon','public.fx_rates','SELECT')
    OR has_table_privilege('authenticated','public.fx_rates','INSERT')
    OR has_function_privilege('authenticated','public.reserve_launch_hold_fx(text,numeric,text,numeric,text,numeric,text,date,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'FX permissions too broad';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.fx_rates'::regclass) THEN
    RAISE EXCEPTION 'FX RLS not enabled';
  END IF;
END;
$$;
ROLLBACK;
-- For a funded fixture in a disposable DB, also verify two identical reservations
-- return the same UUID/metadata, changed metadata rejects atomically, concurrent
-- calls cannot overdraw, and release/deduction lifecycle remains as Segment A.
-- Undo verification: apply the exact undo in a disposable DB and compare its schema
-- against the pre-Segment C schema; neither operation is executed by this artifact.
