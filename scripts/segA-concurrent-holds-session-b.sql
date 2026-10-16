-- See segA-concurrent-holds.sql. Edit all four fixture values in BOTH files.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SET LOCAL lock_timeout = '2s';
DO $$
DECLARE
  email text := 'REPLACE_WITH_STAGING_EMAIL';
  idea_a text := 'REPLACE_WITH_IDEA_A_UUID';
  idea_b text := 'REPLACE_WITH_IDEA_B_UUID';
  amount numeric := 10;
  available numeric;
BEGIN
  IF idea_a=idea_b THEN RAISE EXCEPTION 'Fixture needs distinct proposals'; END IF;
  IF (SELECT count(*) FROM public.ad_ideas WHERE id::text IN (idea_a,idea_b) AND affiliate_email=email) <> 2 THEN
    RAISE EXCEPTION 'Fixture requires two existing proposals owned by wallet'; END IF;
  IF EXISTS(SELECT 1 FROM public.wallet_holds WHERE reference_table='ad_ideas' AND reference_id IN (idea_a,idea_b)) THEN
    RAISE EXCEPTION 'Fixture requires proposals without existing holds'; END IF;
  IF EXISTS(SELECT 1 FROM public.business_activation_subsidies WHERE reserved_for_affiliate_email=email AND status IN ('reserved','partially_consumed'))
    OR EXISTS(SELECT 1 FROM public.affiliate_launch_fund_allocations WHERE affiliate_email=email AND status IN ('allocated','reserved') AND expires_at>now()) THEN
    RAISE EXCEPTION 'Fixture requires no promotional funding sources'; END IF;
  available := public.get_launch_wallet_available(email);
  IF available < amount OR available >= amount*2 THEN RAISE EXCEPTION 'Fixture must fund exactly one hold: available %', available; END IF;
  PERFORM pg_sleep(1); -- Keep both independent transactions overlapping.
  BEGIN
    PERFORM public.reserve_launch_hold(email,'AUD',amount,'ad_ideas',idea_b);
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'PASS: competing reservation blocked; intentional rollback';
  END;
  RAISE EXCEPTION 'FAIL: competing reservation succeeded (or requests did not overlap); intentional rollback';
END $$;
ROLLBACK;
