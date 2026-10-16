-- Operator-only check after applying the migration in a disposable/staging DB.
-- Replace the proposal UUID; no Meta or Stripe calls. All writes roll back.
-- Does not prove two-session serialization: test concurrent reservations separately.
BEGIN;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SET LOCAL segA.test_idea = 'REPLACE_WITH_EXISTING_AD_IDEA_UUID';
DO $$
DECLARE idea public.ad_ideas; h uuid; again uuid; before_available numeric;
  after_available numeric; amount numeric; wallet_reserved bigint;
BEGIN
  SELECT * INTO STRICT idea FROM public.ad_ideas WHERE id::text = current_setting('segA.test_idea');
  IF EXISTS (SELECT 1 FROM public.wallet_holds WHERE reference_table = 'ad_ideas' AND reference_id = idea.id::text) THEN
    RAISE EXCEPTION 'Choose a proposal with no existing hold for this dry-run';
  END IF;
  amount := CASE WHEN idea.budget_amount > 0 THEN round(idea.budget_amount / 100::numeric,2)
    ELSE round(greatest(0,coalesce(idea.daily_budget,0))::numeric,2) END;
  before_available := public.get_launch_wallet_available(idea.affiliate_email);
  h := public.reserve_launch_hold(idea.affiliate_email,'AUD',amount,'ad_ideas',idea.id::text);
  again := public.reserve_launch_hold(idea.affiliate_email,'AUD',amount,'ad_ideas',idea.id::text);
  ASSERT h = again, 'reference must be idempotent';
  SELECT launch_wallet_minor INTO wallet_reserved FROM public.wallet_holds WHERE id = h;
  after_available := public.get_launch_wallet_available(idea.affiliate_email);
  ASSERT after_available = greatest(0,before_available-wallet_reserved/100::numeric), 'wallet availability must exclude hold';
  BEGIN
    PERFORM public.reserve_launch_hold(idea.affiliate_email,'USD',amount,'ad_ideas',idea.id::text);
    RAISE EXCEPTION 'Expected currency rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Paid campaigns currently require AUD%' THEN RAISE; END IF;
  END;
  PERFORM public.release_launch_hold('ad_ideas',idea.id::text);
  ASSERT public.get_launch_wallet_available(idea.affiliate_email) = before_available, 'release restores availability';
  BEGIN
    PERFORM public.reserve_launch_hold(idea.affiliate_email,'AUD',1000000000000,'ad_ideas',idea.id::text);
    RAISE EXCEPTION 'Expected insufficient funding rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Affiliate campaign funding is short by $%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'Idempotency, currency, availability and release checks passed for %', idea.id;
END;
$$;
ROLLBACK;
