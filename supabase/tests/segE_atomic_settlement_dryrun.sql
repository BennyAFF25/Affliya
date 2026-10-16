-- Run with psql -v ON_ERROR_STOP=1 -f this_file after Segments A-D/E are installed.
-- No external calls. All fixture DML and test trigger DDL are rolled back.
-- Requires an existing live ad with a valid offer/idea as a schema-compatible template;
-- creates a new paused runtime row, never settles the template or changes its totals.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE FUNCTION pg_temp.segE_fail_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('segE.force_failure',true) = 'yes' THEN RAISE EXCEPTION 'segE forced failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER segE_test_failure BEFORE INSERT ON public.ad_spend_settlements
FOR EACH ROW EXECUTE FUNCTION pg_temp.segE_fail_settlement();
DO $$
DECLARE
  template public.live_ads; fixture public.live_ads; account_id uuid; hold_id uuid;
  result jsonb; deductions_before bigint; remaining_before bigint; failed boolean := false;
BEGIN
  SELECT * INTO template FROM public.live_ads WHERE ad_idea_id IS NOT NULL AND offer_id IS NOT NULL
    AND (NOT public.is_business_subscription_gate_enabled() OR public.business_has_campaign_launch_entitlement(business_id,business_email))
    AND EXISTS(SELECT 1 FROM public.offers o WHERE o.id=live_ads.offer_id AND o.currency='AUD') LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No valid live-ad template; run in a seeded database'; END IF;
  fixture := jsonb_populate_record(NULL::public.live_ads,to_jsonb(template) || jsonb_build_object(
    'id',gen_random_uuid(),'affiliate_email','segE-' || gen_random_uuid()::text || '@example.invalid',
    'affiliate_user_id',NULL,'currency','AUD','status','paused','spend',20,'spend_transferred',0));
  -- Clone source fields for compatibility with deployed NOT NULL/FK constraints.
  INSERT INTO public.live_ads SELECT fixture.*;
  INSERT INTO public.wallet_topups(affiliate_email,amount_net,credited_amount,amount_gross,amount_refunded,stripe_id,status,currency,currency_source)
    VALUES(fixture.affiliate_email,100,100,100,0,'segE-' || gen_random_uuid()::text,'succeeded','AUD','verified');
  INSERT INTO public.wallet_accounts(owner_email,currency) VALUES(fixture.affiliate_email,'AUD') ON CONFLICT DO NOTHING;
  SELECT id INTO account_id FROM public.wallet_accounts WHERE owner_email=fixture.affiliate_email AND currency='AUD' FOR UPDATE;
  -- Isolate the fixture hold by a fixture proposal clone rather than touching a real hold.
  INSERT INTO public.ad_ideas SELECT (jsonb_populate_record(NULL::public.ad_ideas,
    to_jsonb(i) || jsonb_build_object('id',gen_random_uuid(),'affiliate_email',fixture.affiliate_email,'currency','AUD','status','pending'))).* FROM public.ad_ideas i
    WHERE i.id=fixture.ad_idea_id RETURNING id INTO fixture.ad_idea_id;
  UPDATE public.live_ads SET ad_idea_id=fixture.ad_idea_id WHERE id=fixture.id;
  INSERT INTO public.wallet_holds(account_id,currency,amount_minor,status,reference_table,reference_id,
    launch_remaining_minor,launch_wallet_minor,launch_source_minor,launch_offer_id)
    VALUES(account_id,'AUD',2000,'active','ad_ideas',fixture.ad_idea_id::text,2000,2000,0,fixture.offer_id) RETURNING id INTO hold_id;
  result := public.settle_live_ad_spend(fixture.id,0,5,5,5,NULL,0,'AUD');
  IF result->>'applied' <> 'true' OR NOT EXISTS(SELECT 1 FROM public.wallet_deductions WHERE ad_id=fixture.id::text AND amount=5)
    OR NOT EXISTS(SELECT 1 FROM public.ad_spend_settlements WHERE live_ad_id=fixture.id AND amount=5)
    OR (SELECT spend_transferred FROM public.live_ads WHERE id=fixture.id) <> 5
    OR (SELECT launch_remaining_minor FROM public.wallet_holds WHERE id=hold_id) <> 1500 THEN RAISE EXCEPTION 'Happy path failed'; END IF;
  SELECT count(*) INTO deductions_before FROM public.wallet_deductions WHERE ad_id=fixture.id::text;
  SELECT launch_remaining_minor INTO remaining_before FROM public.wallet_holds WHERE id=hold_id;
  result := public.settle_live_ad_spend(fixture.id,0,5,5,5,NULL,0,'AUD');
  IF result->>'applied' <> 'false' OR (SELECT count(*) FROM public.wallet_deductions WHERE ad_id=fixture.id::text) <> deductions_before THEN RAISE EXCEPTION 'Idempotency failed'; END IF;
  PERFORM set_config('segE.force_failure','yes',true);
  BEGIN
    PERFORM public.settle_live_ad_spend(fixture.id,5,5,5,5,NULL,0,'AUD');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'segE forced failure' THEN RAISE; END IF;
    failed := true;
  END;
  IF NOT failed OR (SELECT count(*) FROM public.wallet_deductions WHERE ad_id=fixture.id::text) <> deductions_before
    OR (SELECT launch_remaining_minor FROM public.wallet_holds WHERE id=hold_id) <> remaining_before
    OR (SELECT spend_transferred FROM public.live_ads WHERE id=fixture.id) <> 5
    OR (SELECT count(*) FROM public.ad_spend_settlements WHERE live_ad_id=fixture.id) <> 1 THEN RAISE EXCEPTION 'Rollback failed'; END IF;
  -- Existing unpaid foreign spend must be converted before comparing AUD holds.
  IF public.launch_wallet_available_minor(fixture.affiliate_email) <> 8000 THEN RAISE EXCEPTION 'AUD availability changed'; END IF;
  INSERT INTO public.fx_rates(base,quote,rate,rate_date,source,fetched_at)
    VALUES('USD','AUD',1.5,current_date,'frankfurter',now()+interval '1 second')
    ON CONFLICT(base,quote,rate_date,source) DO UPDATE SET rate=excluded.rate,fetched_at=excluded.fetched_at;
  UPDATE public.live_ads SET currency='USD' WHERE id=fixture.id;
  IF public.launch_wallet_available_minor(fixture.affiliate_email) <> 7250 THEN RAISE EXCEPTION 'FX pending availability failed'; END IF;
  RAISE NOTICE 'Segment E happy path, repeat and forced-failure rollback passed';
END;
$$;
ROLLBACK;
