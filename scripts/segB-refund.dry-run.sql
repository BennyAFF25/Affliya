-- Operator only, staging after migration; choose an unlocked funded wallet/top-up.
-- All writes rolled back. No external APIs. Edit fixture below.
BEGIN;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
DO $$
DECLARE email text := 'REPLACE_WITH_STAGING_EMAIL'; topup uuid := '00000000-0000-0000-0000-000000000000';
  before numeric; a jsonb; duplicate jsonb;
BEGIN
  before := public.get_launch_wallet_available(email);
  IF before < 1 THEN RAISE EXCEPTION 'Need at least 1 AUD'; END IF;
  a := public.claim_wallet_refund(email,topup,1,'segB-dry-run');
  ASSERT (a->>'claimed')::boolean;
  ASSERT public.get_launch_wallet_available(email)=before-1, 'Pending reservation excludes funds';
  duplicate := public.claim_wallet_refund(email,topup,1,'segB-dry-run');
  ASSERT NOT (duplicate->>'claimed')::boolean;
  ASSERT duplicate->'attempt'->>'id'=a->'attempt'->>'id';
  PERFORM public.finish_wallet_refund((a->'attempt'->>'id')::uuid,'failed',NULL,NULL,NULL,'dry run');
  ASSERT public.get_launch_wallet_available(email)=before, 'Failure releases funds';
  a := public.claim_wallet_refund(email,topup,1,'segB-dry-run');
  ASSERT (a->>'claimed')::boolean, 'Failed request can retry with new attempt identity';
  PERFORM public.finish_wallet_refund((a->'attempt'->>'id')::uuid,'succeeded','re_segB_dry_run','ch_segB_dry_run','aud');
  PERFORM public.finish_wallet_refund((a->'attempt'->>'id')::uuid,'succeeded','re_segB_dry_run','ch_segB_dry_run','aud');
  ASSERT public.get_launch_wallet_available(email)=before-1, 'Finalization never double-debits';
END $$;
ROLLBACK;
