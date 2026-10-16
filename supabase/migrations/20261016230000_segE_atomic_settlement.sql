BEGIN;
-- Pending spend must also use AUD before subtracting AUD holds. Missing FX
-- conservatively exposes zero launch capacity. Legacy unrecorded AUD behavior is preserved.
CREATE OR REPLACE FUNCTION public.launch_wallet_available_minor(p_affiliate_email text, p_exclude_reference_id text DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH balance AS (
    SELECT greatest(0, coalesce(sum(topups_net_available - deducted_total), 0)) * 100 AS minor
    FROM public.affiliate_wallet_balances_by_currency WHERE affiliate_email = p_affiliate_email
  ), holds AS (
    SELECT h.* FROM public.wallet_holds h JOIN public.wallet_accounts a ON a.id = h.account_id
    WHERE a.owner_email = p_affiliate_email AND a.currency = 'AUD' AND h.status = 'active'
  ), original_spend AS (
    SELECT l.*, coalesce(l.currency,o.currency,'AUD') AS spend_currency,
      greatest(0,
        (CASE WHEN l.spend IS NULL OR l.spend::text IN ('NaN','Infinity','-Infinity') THEN 0 ELSE floor(l.spend::double precision * 100 + 0.5) END) -
        (CASE WHEN l.spend_transferred IS NULL OR l.spend_transferred::text IN ('NaN','Infinity','-Infinity') THEN 0 ELSE floor(l.spend_transferred::double precision * 100 + 0.5) END)) AS unpaid_minor
    FROM public.live_ads l LEFT JOIN public.offers o ON o.id=l.offer_id
    WHERE l.affiliate_email=p_affiliate_email
  ), converted AS (
    SELECT l.*, CASE WHEN unpaid_minor=0 THEN 0 WHEN spend_currency='AUD' THEN unpaid_minor
      ELSE round(unpaid_minor::numeric * (
        SELECT f.rate FROM public.fx_rates f WHERE f.base=l.spend_currency AND f.quote='AUD'
          AND f.source IN ('frankfurter','open.er-api')
          AND f.rate_date <= current_date AND f.rate_date::timestamp >= now()-interval '72 hours'
          AND f.rate::text NOT IN ('NaN','Infinity','-Infinity')
          AND CASE f.base WHEN 'USD' THEN f.rate BETWEEN 0.5 AND 3 WHEN 'GBP' THEN f.rate BETWEEN 0.8 AND 4 WHEN 'CAD' THEN f.rate BETWEEN 0.4 AND 2.5 ELSE false END
        ORDER BY f.rate_date DESC,f.fetched_at DESC LIMIT 1
      ),0) END AS aud_minor FROM original_spend l
  ), pending AS (
    SELECT coalesce(sum(greatest(0,l.aud_minor-coalesce((
      SELECT sum(coalesce(h.launch_remaining_minor,h.amount_minor)) FROM holds h
      WHERE h.reference_table='ad_ideas' AND h.reference_id=l.ad_idea_id::text),0))),0) AS minor,
      coalesce(bool_or(l.aud_minor IS NULL),false) AS unresolved FROM converted l
  )
  SELECT CASE WHEN pending.unresolved THEN 0 ELSE greatest(0, balance.minor - pending.minor - coalesce((SELECT sum(coalesce(launch_wallet_minor, amount_minor))
    FROM holds WHERE reference_id IS DISTINCT FROM p_exclude_reference_id), 0)) END FROM balance, pending;
$$;

-- No canonical or shadow trigger is replaced. Shadow ledger errors remain guarded.
CREATE FUNCTION public.settle_live_ad_spend(
  p_live_ad_id uuid, p_expected_previous numeric, p_original_amount numeric,
  p_amount_aud numeric, p_wallet_amount_aud numeric, p_subsidy_id uuid,
  p_subsidy_amount_aud numeric, p_original_currency text,
  p_fx_rate numeric DEFAULT NULL, p_fx_source text DEFAULT NULL, p_fx_rate_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  ad public.live_ads; subsidy public.business_activation_subsidies;
  previous numeric; following numeric; key text; deduction_id text; settlement_id uuid;
BEGIN
  SELECT * INTO ad FROM public.live_ads WHERE id = p_live_ad_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Live ad not found'; END IF;
  previous := coalesce(ad.spend_transferred,0);
  IF p_expected_previous IS NULL OR p_expected_previous::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid expected total'; END IF;
  IF previous > p_expected_previous THEN
    RETURN jsonb_build_object('applied',false,'transferred_after',previous);
  END IF;
  IF previous <> p_expected_previous THEN RAISE EXCEPTION 'Settlement total changed; retry'; END IF;
  IF p_original_currency IS NULL OR p_original_currency NOT IN ('AUD','USD','GBP','CAD')
    OR p_original_amount IS NULL OR p_original_amount <= 0 OR p_original_amount::text IN ('NaN','Infinity','-Infinity')
    OR p_original_amount*100 <> trunc(p_original_amount*100)
    OR p_amount_aud IS NULL OR p_amount_aud <= 0 OR p_amount_aud::text IN ('NaN','Infinity','-Infinity')
    OR p_amount_aud*100 <> trunc(p_amount_aud*100)
    OR p_wallet_amount_aud IS NULL OR p_wallet_amount_aud < 0 OR p_wallet_amount_aud::text IN ('NaN','Infinity','-Infinity')
    OR p_wallet_amount_aud*100 <> trunc(p_wallet_amount_aud*100)
    OR p_subsidy_amount_aud IS NULL OR p_subsidy_amount_aud < 0 OR p_subsidy_amount_aud::text IN ('NaN','Infinity','-Infinity')
    OR p_subsidy_amount_aud*100 <> trunc(p_subsidy_amount_aud*100)
    OR p_wallet_amount_aud+p_subsidy_amount_aud <> p_amount_aud
    OR previous+p_original_amount > coalesce(ad.spend,0) THEN RAISE EXCEPTION 'Invalid settlement amounts'; END IF;
  IF p_original_currency = 'AUD' THEN
    IF p_original_amount <> p_amount_aud OR p_fx_rate IS NOT NULL OR p_fx_source IS NOT NULL OR p_fx_rate_date IS NOT NULL THEN RAISE EXCEPTION 'Invalid AUD settlement'; END IF;
  ELSIF p_fx_rate IS NULL OR p_fx_rate <= 0 OR p_fx_rate::text IN ('NaN','Infinity','-Infinity')
    OR p_fx_source IS NULL OR p_fx_source NOT IN ('frankfurter','open.er-api')
    OR p_fx_rate_date IS NULL OR p_fx_rate_date > current_date
    OR round(p_original_amount*p_fx_rate,2) <> p_amount_aud THEN RAISE EXCEPTION 'Invalid FX settlement'; END IF;
  -- Same affiliate-account lock as launch reservation and hold consumption.
  INSERT INTO public.wallet_accounts(owner_email,currency) VALUES(ad.affiliate_email,'AUD') ON CONFLICT(owner_email,currency) DO NOTHING;
  PERFORM 1 FROM public.wallet_accounts WHERE owner_email=ad.affiliate_email AND currency='AUD' FOR UPDATE;
  IF p_wallet_amount_aud > coalesce((SELECT sum(topups_net_available-deducted_total)
    FROM public.affiliate_wallet_balances_by_currency WHERE affiliate_email=ad.affiliate_email),0) THEN
    RAISE EXCEPTION 'Wallet balance changed; retry';
  END IF;
  IF p_subsidy_amount_aud > 0 THEN
    SELECT * INTO subsidy FROM public.business_activation_subsidies WHERE id=p_subsidy_id FOR UPDATE;
    IF NOT FOUND OR subsidy.offer_id IS DISTINCT FROM ad.offer_id OR subsidy.business_email IS DISTINCT FROM ad.business_email
      OR subsidy.reserved_for_affiliate_email IS DISTINCT FROM ad.affiliate_email
      OR subsidy.status NOT IN ('reserved','partially_consumed')
      OR coalesce(subsidy.subsidy_amount,0)-coalesce(subsidy.consumed_amount,0) < p_subsidy_amount_aud THEN RAISE EXCEPTION 'Subsidy changed; retry'; END IF;
    UPDATE public.business_activation_subsidies SET consumed_amount=coalesce(consumed_amount,0)+p_subsidy_amount_aud,
      consumed_by_affiliate_email=ad.affiliate_email,live_ad_id=ad.id,consumed_at=now(),updated_at=now(),
      status=CASE WHEN coalesce(consumed_amount,0)+p_subsidy_amount_aud >= subsidy_amount THEN 'consumed' ELSE 'partially_consumed' END WHERE id=p_subsidy_id;
  END IF;
  following := previous+p_original_amount;
  key := ad.id::text || ':' || trim(trailing '.' from trim(trailing '0' from to_char(following,'FM999999999999990.00')));
  IF p_wallet_amount_aud > 0 THEN
    INSERT INTO public.wallet_deductions(affiliate_email,business_email,offer_id,ad_id,amount,description,settlement_key,
      business_id,affiliate_user_id,currency,currency_source,original_amount,original_currency,fx_rate,fx_source,fx_rate_date)
    VALUES(ad.affiliate_email,ad.business_email,ad.offer_id,ad.id,p_wallet_amount_aud,CASE WHEN p_subsidy_amount_aud>0 THEN 'Meta ad spend settlement (starter spend applied: $' || to_char(p_subsidy_amount_aud,'FM999999999990.00') || ')' ELSE 'Meta ad spend settlement' END,key,
      ad.business_id,ad.affiliate_user_id,'AUD','verified',
      CASE WHEN p_fx_rate IS NOT NULL THEN CASE WHEN p_subsidy_amount_aud=0 THEN p_original_amount ELSE p_wallet_amount_aud/p_fx_rate END END,
      CASE WHEN p_fx_rate IS NOT NULL THEN p_original_currency END,p_fx_rate,p_fx_source,p_fx_rate_date)
    RETURNING id::text INTO deduction_id;
    -- Existing trigger is best effort; this mandatory idempotent call makes hold failure fatal here.
    PERFORM public.consume_launch_hold(deduction_id);
  END IF;
  IF p_subsidy_amount_aud > 0 THEN
    UPDATE public.wallet_holds SET
      launch_remaining_minor=greatest(0,coalesce(launch_remaining_minor,amount_minor)-p_subsidy_amount_aud*100),
      launch_source_minor=greatest(0,coalesce(launch_source_minor,0)-p_subsidy_amount_aud*100),
      status=CASE WHEN coalesce(launch_remaining_minor,amount_minor)<=p_subsidy_amount_aud*100 THEN 'consumed' ELSE 'active' END,
      updated_at=now()
      WHERE reference_table='ad_ideas' AND reference_id=ad.ad_idea_id::text AND status='active';
  END IF;
  INSERT INTO public.ad_spend_settlements(settlement_key,live_ad_id,affiliate_email,business_email,offer_id,business_id,affiliate_user_id,
    amount,spend,transferred_before,transferred_after,unpaid_before,unpaid_after,status,next_retry_at,metadata,
    currency,currency_source,original_amount,original_currency,fx_rate,fx_source,fx_rate_date)
  VALUES(key,ad.id,ad.affiliate_email,ad.business_email,ad.offer_id,ad.business_id,ad.affiliate_user_id,
    p_amount_aud,ad.spend,previous,following,greatest(0,ad.spend-previous),greatest(0,ad.spend-following),'pending_funds',now(),
    jsonb_build_object('source','app/api/ad-spend/settle/route.ts','walletChargeAmount',p_wallet_amount_aud,'subsidyAppliedAmount',p_subsidy_amount_aud,'activationSubsidyId',p_subsidy_id),
    'AUD','verified',CASE WHEN p_fx_rate IS NOT NULL THEN p_original_amount END,
    CASE WHEN p_fx_rate IS NOT NULL THEN p_original_currency END,p_fx_rate,p_fx_source,p_fx_rate_date) RETURNING id INTO settlement_id;
  UPDATE public.live_ads SET spend_transferred=following WHERE id=ad.id;
  RETURN jsonb_build_object('id',settlement_id,'applied',true,'transferred_after',following);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_live_ad_spend(uuid,numeric,numeric,numeric,numeric,uuid,numeric,text,numeric,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_live_ad_spend(uuid,numeric,numeric,numeric,numeric,uuid,numeric,text,numeric,text,date) TO service_role;
COMMIT;
