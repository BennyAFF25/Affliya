-- Segment 8: Ben-approved historical evidence; no amount conversion.
-- Evidence: /workspace/db-backups/20261015-215926-seg8/_evidence.json
-- Inferred is not verified. Deleted-offer payouts stay NULL/unresolved.
BEGIN;

DO $classification$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_updated bigint;
  v_total bigint;
BEGIN
  PERFORM 1 FROM public.wallet_topups WHERE id IN ('5e7e145c-9dbc-4d7a-a974-75aafb345ef7', '7fd1d936-5b6d-4684-978f-fe30b0f1d148', '2ad4bdde-acd5-44b4-9b3d-2f0585694757', 'de9cc65b-37d9-4135-a8c0-ad55ae602a96', '5599924b-e217-4296-80dd-fe796562857a') FOR UPDATE;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_before FROM public.wallet_topups t WHERE id IN ('5e7e145c-9dbc-4d7a-a974-75aafb345ef7', '7fd1d936-5b6d-4684-978f-fe30b0f1d148', '2ad4bdde-acd5-44b4-9b3d-2f0585694757', 'de9cc65b-37d9-4135-a8c0-ad55ae602a96', '5599924b-e217-4296-80dd-fe796562857a');
  v_total := 0;

  UPDATE public.wallet_topups
  SET currency = 'AUD', currency_source = 'inferred'
  WHERE id IN ('5e7e145c-9dbc-4d7a-a974-75aafb345ef7', '7fd1d936-5b6d-4684-978f-fe30b0f1d148', '2ad4bdde-acd5-44b4-9b3d-2f0585694757', 'de9cc65b-37d9-4135-a8c0-ad55ae602a96', '5599924b-e217-4296-80dd-fe796562857a')
    AND currency IS NULL AND currency_source IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;
  IF v_total <> 5 THEN
    RAISE EXCEPTION 'Segment 8 wallet_topups: expected 5 updates, got %', v_total;
  END IF;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_after FROM public.wallet_topups t WHERE id IN ('5e7e145c-9dbc-4d7a-a974-75aafb345ef7', '7fd1d936-5b6d-4684-978f-fe30b0f1d148', '2ad4bdde-acd5-44b4-9b3d-2f0585694757', 'de9cc65b-37d9-4135-a8c0-ad55ae602a96', '5599924b-e217-4296-80dd-fe796562857a');
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'Segment 8 wallet_topups: non-currency fields changed';
  END IF;

  PERFORM 1 FROM public.wallet_refunds WHERE id IN ('32edeab7-d0b4-41cc-97a1-e3b2480e2055') FOR UPDATE;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_before FROM public.wallet_refunds t WHERE id IN ('32edeab7-d0b4-41cc-97a1-e3b2480e2055');
  v_total := 0;

  UPDATE public.wallet_refunds
  SET currency = 'AUD', currency_source = 'inferred'
  WHERE id IN ('32edeab7-d0b4-41cc-97a1-e3b2480e2055')
    AND currency IS NULL AND currency_source IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;
  IF v_total <> 1 THEN
    RAISE EXCEPTION 'Segment 8 wallet_refunds: expected 1 updates, got %', v_total;
  END IF;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_after FROM public.wallet_refunds t WHERE id IN ('32edeab7-d0b4-41cc-97a1-e3b2480e2055');
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'Segment 8 wallet_refunds: non-currency fields changed';
  END IF;

  PERFORM 1 FROM public.wallet_payouts WHERE id IN ('f8025e53-d432-482f-ad7e-08124c5b14a4', '6004c3cd-62be-4d41-8eb6-2dd72b992b9d', '7c56e16d-efa5-41d6-9425-75b00497d796') FOR UPDATE;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_before FROM public.wallet_payouts t WHERE id IN ('f8025e53-d432-482f-ad7e-08124c5b14a4', '6004c3cd-62be-4d41-8eb6-2dd72b992b9d', '7c56e16d-efa5-41d6-9425-75b00497d796');
  v_total := 0;

  UPDATE public.wallet_payouts
  SET currency = 'AUD', currency_source = 'inferred'
  WHERE id IN ('f8025e53-d432-482f-ad7e-08124c5b14a4')
    AND currency IS NULL AND currency_source IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;

  UPDATE public.wallet_payouts
  SET currency = NULL, currency_source = 'unresolved'
  WHERE id IN ('6004c3cd-62be-4d41-8eb6-2dd72b992b9d', '7c56e16d-efa5-41d6-9425-75b00497d796')
    AND currency IS NULL AND currency_source IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;
  IF v_total <> 3 THEN
    RAISE EXCEPTION 'Segment 8 wallet_payouts: expected 3 updates, got %', v_total;
  END IF;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_after FROM public.wallet_payouts t WHERE id IN ('f8025e53-d432-482f-ad7e-08124c5b14a4', '6004c3cd-62be-4d41-8eb6-2dd72b992b9d', '7c56e16d-efa5-41d6-9425-75b00497d796');
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'Segment 8 wallet_payouts: non-currency fields changed';
  END IF;

  PERFORM 1 FROM public.live_ads WHERE id IN ('3e0c466c-a2a3-4a3d-aa71-df0b90bbdc83', '271271fa-2563-4fc4-995e-7e276d0cc09e', 'e1b62502-2ed8-4302-821c-ce21af809844', '66f13993-a48b-47e6-a936-bd8b1ebeed1f') FOR UPDATE;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_before FROM public.live_ads t WHERE id IN ('3e0c466c-a2a3-4a3d-aa71-df0b90bbdc83', '271271fa-2563-4fc4-995e-7e276d0cc09e', 'e1b62502-2ed8-4302-821c-ce21af809844', '66f13993-a48b-47e6-a936-bd8b1ebeed1f');
  v_total := 0;

  UPDATE public.live_ads
  SET currency = 'AUD', currency_source = 'inferred'
  WHERE id IN ('3e0c466c-a2a3-4a3d-aa71-df0b90bbdc83', '271271fa-2563-4fc4-995e-7e276d0cc09e', 'e1b62502-2ed8-4302-821c-ce21af809844', '66f13993-a48b-47e6-a936-bd8b1ebeed1f')
    AND currency IS NULL AND currency_source IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_total := v_total + v_updated;
  IF v_total <> 4 THEN
    RAISE EXCEPTION 'Segment 8 live_ads: expected 4 updates, got %', v_total;
  END IF;
  SELECT jsonb_object_agg(id::text, to_jsonb(t) - 'currency' - 'currency_source')
  INTO v_after FROM public.live_ads t WHERE id IN ('3e0c466c-a2a3-4a3d-aa71-df0b90bbdc83', '271271fa-2563-4fc4-995e-7e276d0cc09e', 'e1b62502-2ed8-4302-821c-ce21af809844', '66f13993-a48b-47e6-a936-bd8b1ebeed1f');
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'Segment 8 live_ads: non-currency fields changed';
  END IF;

END;
$classification$;

-- Single summary audit entry, after every assertion; rolled back on any failure.
INSERT INTO public.money_flow_audit_log (event_type, source_route, reason_code, message, metadata)
VALUES ('currency_historical_classification', 'migration:20261015160000_currency_seg8_historical_classification',
  'evidence_based_inference', '11 AUD/inferred rows; 2 deleted-offer payouts remain NULL/unresolved. No amounts changed.',
  '{"migration":"20261015160000_currency_seg8_historical_classification","evidence":"20261015-215926-seg8/_evidence.json","counts":{"wallet_topups":5,"wallet_refunds":1,"wallet_payouts":3,"live_ads":4},"classifications":[{"table":"wallet_topups","ids":["5e7e145c-9dbc-4d7a-a974-75aafb345ef7","7fd1d936-5b6d-4684-978f-fe30b0f1d148","2ad4bdde-acd5-44b4-9b3d-2f0585694757","de9cc65b-37d9-4135-a8c0-ad55ae602a96","5599924b-e217-4296-80dd-fe796562857a"],"currency":"AUD","currency_source":"inferred"},{"table":"wallet_refunds","ids":["32edeab7-d0b4-41cc-97a1-e3b2480e2055"],"currency":"AUD","currency_source":"inferred"},{"table":"wallet_payouts","ids":["f8025e53-d432-482f-ad7e-08124c5b14a4"],"currency":"AUD","currency_source":"inferred"},{"table":"wallet_payouts","ids":["6004c3cd-62be-4d41-8eb6-2dd72b992b9d","7c56e16d-efa5-41d6-9425-75b00497d796"],"currency":null,"currency_source":"unresolved"},{"table":"live_ads","ids":["3e0c466c-a2a3-4a3d-aa71-df0b90bbdc83","271271fa-2563-4fc4-995e-7e276d0cc09e","e1b62502-2ed8-4302-821c-ce21af809844","66f13993-a48b-47e6-a936-bd8b1ebeed1f"],"currency":"AUD","currency_source":"inferred"}]}'::jsonb);

COMMIT;
