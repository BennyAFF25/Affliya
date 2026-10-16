BEGIN;

ALTER TABLE public.wallet_holds
  ADD COLUMN launch_remaining_minor bigint CHECK (launch_remaining_minor >= 0),
  ADD COLUMN launch_wallet_minor bigint CHECK (launch_wallet_minor >= 0),
  ADD COLUMN launch_offer_id uuid,
  ADD COLUMN launch_source_minor bigint CHECK (launch_source_minor >= 0);
CREATE UNIQUE INDEX segA_launch_hold_reference ON public.wallet_holds(reference_table, reference_id)
  WHERE reference_table = 'ad_ideas';

-- One formula for advisory reads and the locked reservation. Legacy NULL-currency
-- entries remain included, matching balance.ts (AUD-only containment, no FX).
CREATE FUNCTION public.launch_wallet_available_minor(p_affiliate_email text, p_exclude_reference_id text DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH balance AS (
    SELECT greatest(0, coalesce(sum(topups_net_available - deducted_total), 0)) * 100 AS minor
    FROM public.affiliate_wallet_balances_by_currency WHERE affiliate_email = p_affiliate_email
  ), holds AS (
    SELECT h.* FROM public.wallet_holds h JOIN public.wallet_accounts a ON a.id = h.account_id
    WHERE a.owner_email = p_affiliate_email AND a.currency = 'AUD' AND h.status = 'active'
  ), pending AS (
    SELECT coalesce(sum(greatest(0,
      (CASE WHEN l.spend IS NULL OR l.spend::text IN ('NaN','Infinity','-Infinity') THEN 0 ELSE floor(l.spend::double precision * 100 + 0.5) END) -
      (CASE WHEN l.spend_transferred IS NULL OR l.spend_transferred::text IN ('NaN','Infinity','-Infinity') THEN 0 ELSE floor(l.spend_transferred::double precision * 100 + 0.5) END) -
      coalesce((SELECT sum(coalesce(h.launch_remaining_minor, h.amount_minor)) FROM holds h
        WHERE h.reference_table = 'ad_ideas' AND h.reference_id = l.ad_idea_id::text), 0))), 0) AS minor
    FROM public.live_ads l WHERE l.affiliate_email = p_affiliate_email
  )
  SELECT greatest(0, balance.minor - pending.minor - coalesce((SELECT sum(coalesce(launch_wallet_minor, amount_minor))
    FROM holds WHERE reference_id IS DISTINCT FROM p_exclude_reference_id), 0)) FROM balance, pending;
$$;

CREATE FUNCTION public.get_launch_wallet_available(p_affiliate_email text, p_exclude_reference_id text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND
    (p_affiliate_email IS DISTINCT FROM (auth.jwt()->>'email') OR p_exclude_reference_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Wallet access denied';
  END IF;
  RETURN public.launch_wallet_available_minor(p_affiliate_email, p_exclude_reference_id) / 100;
END;
$$;

-- Service-only source accounting used by the existing readiness contract.
CREATE FUNCTION public.get_launch_source_reserved(p_affiliate_email text, p_offer_id uuid, p_exclude_reference_id text DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(sum(h.launch_source_minor),0) / 100 FROM public.wallet_holds h
  JOIN public.wallet_accounts a ON a.id = h.account_id
  WHERE a.owner_email = p_affiliate_email AND a.currency = 'AUD' AND h.status = 'active'
    AND h.launch_offer_id = p_offer_id AND h.reference_id IS DISTINCT FROM p_exclude_reference_id;
$$;

CREATE FUNCTION public.reserve_launch_hold(p_affiliate_email text, p_currency text, p_amount numeric,
  p_reference_type text, p_reference_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  account public.wallet_accounts; existing public.wallet_holds; idea public.ad_ideas;
  required bigint; wallet_required bigint; sources bigint := 0; subsidy numeric := 0; promo numeric := 0;
  available numeric; hold_id uuid;
BEGIN
  IF p_currency IS DISTINCT FROM 'AUD' THEN RAISE EXCEPTION 'Paid campaigns currently require AUD campaign and Meta account currency.'; END IF;
  IF p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount <= 0 OR p_amount * 100 <> trunc(p_amount * 100)
    OR p_reference_type IS DISTINCT FROM 'ad_ideas' THEN RAISE EXCEPTION 'Invalid launch hold request'; END IF;
  SELECT * INTO idea FROM public.ad_ideas WHERE id::text = p_reference_id AND affiliate_email = p_affiliate_email;
  IF NOT FOUND THEN RAISE EXCEPTION 'Launch proposal not found'; END IF;
  required := p_amount * 100;
  INSERT INTO public.wallet_accounts(owner_email, currency) VALUES (p_affiliate_email, 'AUD') ON CONFLICT (owner_email, currency) DO NOTHING;
  SELECT * INTO account FROM public.wallet_accounts WHERE owner_email = p_affiliate_email AND currency = 'AUD' FOR UPDATE;
  IF account.status <> 'active' THEN RAISE EXCEPTION 'Wallet account is not active'; END IF;
  SELECT * INTO existing FROM public.wallet_holds WHERE reference_table = p_reference_type AND reference_id = p_reference_id FOR UPDATE;
  IF FOUND AND existing.account_id <> account.id THEN RAISE EXCEPTION 'Launch hold owner mismatch'; END IF;
  IF existing.status = 'active' THEN
    IF existing.amount_minor <> required THEN RAISE EXCEPTION 'Launch hold amount changed'; END IF;
    RETURN existing.id;
  END IF;

  -- Preserve the same eligible sources as paidCampaignLaunchReadiness; the account
  -- lock also serializes their use by concurrent campaigns for this affiliate.
  SELECT greatest(0, subsidy_amount - coalesce(consumed_amount, 0)) INTO subsidy
    FROM public.business_activation_subsidies WHERE offer_id = idea.offer_id
      AND reserved_for_affiliate_email = p_affiliate_email AND status IN ('reserved','partially_consumed') LIMIT 1;
  SELECT CASE WHEN allocated_for_campaign_id IS NULL THEN amount ELSE 0 END INTO promo
    FROM public.affiliate_launch_fund_allocations WHERE affiliate_email = p_affiliate_email
      AND allocated_for_offer_id = idea.offer_id AND status IN ('allocated','reserved') AND expires_at > now()
    ORDER BY allocated_at LIMIT 1;
  sources := greatest(0, floor((coalesce(subsidy,0) + coalesce(promo,0)) * 100 + 0.5) - coalesce((
    SELECT sum(launch_source_minor) FROM public.wallet_holds WHERE account_id = account.id
      AND status = 'active' AND launch_offer_id = idea.offer_id),0));
  wallet_required := greatest(0, required - sources);
  available := public.launch_wallet_available_minor(p_affiliate_email);
  IF wallet_required > available THEN
    RAISE EXCEPTION 'Affiliate campaign funding is short by $%.', to_char((wallet_required - available)/100, 'FM999999999990.00');
  END IF;
  IF existing.id IS NOT NULL THEN
    UPDATE public.wallet_holds SET amount_minor = required, launch_remaining_minor = required,
      launch_wallet_minor = wallet_required, launch_source_minor = required - wallet_required,
      status = 'active', updated_at = now() WHERE id = existing.id RETURNING id INTO hold_id;
  ELSE
    INSERT INTO public.wallet_holds(account_id,currency,amount_minor,status,reference_table,reference_id,
      launch_remaining_minor,launch_wallet_minor,launch_source_minor,launch_offer_id)
    VALUES(account.id,'AUD',required,'active',p_reference_type,p_reference_id,required,wallet_required,required-wallet_required,idea.offer_id)
    RETURNING id INTO hold_id;
  END IF;
  RETURN hold_id;
END;
$$;

CREATE FUNCTION public.release_launch_hold(p_reference_type text, p_reference_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.wallet_accounts a JOIN public.wallet_holds h ON h.account_id = a.id
    WHERE h.reference_table = p_reference_type AND h.reference_id = p_reference_id FOR UPDATE OF a;
  UPDATE public.wallet_holds SET status = 'released', launch_remaining_minor = 0,
    launch_wallet_minor = 0, launch_source_minor = 0, updated_at = now()
    WHERE reference_table = p_reference_type AND reference_id = p_reference_id AND status = 'active';
END;
$$;

-- Deduction IDs provide idempotency, including retries after partial settlement.
CREATE TABLE public.launch_hold_consumptions (
  deduction_id text PRIMARY KEY, hold_id uuid NOT NULL REFERENCES public.wallet_holds(id),
  amount_minor bigint NOT NULL CHECK(amount_minor > 0)
);
ALTER TABLE public.launch_hold_consumptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.launch_hold_consumptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.launch_hold_consumptions TO service_role;
CREATE FUNCTION public.consume_launch_hold(p_deduction_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE d public.wallet_deductions; h public.wallet_holds; amount bigint; ref text;
BEGIN
  SELECT * INTO d FROM public.wallet_deductions WHERE id::text = p_deduction_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT ad_idea_id::text INTO ref FROM public.live_ads WHERE id::text = d.ad_id::text;
  PERFORM 1 FROM public.wallet_accounts WHERE owner_email = d.affiliate_email AND currency = 'AUD' FOR UPDATE;
  SELECT * INTO h FROM public.wallet_holds WHERE reference_table = 'ad_ideas' AND reference_id = ref AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  amount := greatest(0, floor(d.amount::double precision * 100 + 0.5));
  IF amount = 0 THEN RETURN; END IF;
  INSERT INTO public.launch_hold_consumptions VALUES(p_deduction_id,h.id,amount) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.wallet_holds SET launch_remaining_minor = greatest(0, coalesce(launch_remaining_minor,amount_minor)-amount),
    launch_wallet_minor = greatest(0, coalesce(launch_wallet_minor,amount_minor)-amount),
    status = CASE WHEN coalesce(launch_remaining_minor,amount_minor) <= amount THEN 'consumed' ELSE 'active' END,
    updated_at = now() WHERE id = h.id;
END;
$$;
CREATE FUNCTION public.segA_hold_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'wallet_deductions' THEN
    BEGIN PERFORM public.consume_launch_hold(NEW.id::text);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Launch hold consumption failed for deduction %: %', NEW.id, SQLERRM; END;
  ELSIF TG_TABLE_NAME = 'ad_ideas' THEN
    IF NEW.status = 'rejected' THEN PERFORM public.release_launch_hold('ad_ideas',NEW.id::text); END IF;
  ELSE
    IF lower(NEW.status) IN ('paused','stopped','archived','rejected','deleted','completed','ended') THEN
      PERFORM public.release_launch_hold('ad_ideas',NEW.ad_idea_id::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER segA_deduction_hold AFTER INSERT ON public.wallet_deductions FOR EACH ROW EXECUTE FUNCTION public.segA_hold_lifecycle();
CREATE TRIGGER segA_idea_hold AFTER UPDATE OF status ON public.ad_ideas FOR EACH ROW EXECUTE FUNCTION public.segA_hold_lifecycle();
CREATE TRIGGER segA_ad_hold AFTER UPDATE OF status ON public.live_ads FOR EACH ROW EXECUTE FUNCTION public.segA_hold_lifecycle();

REVOKE ALL ON FUNCTION public.launch_wallet_available_minor(text,text), public.get_launch_wallet_available(text,text),
 public.get_launch_source_reserved(text,uuid,text), public.reserve_launch_hold(text,text,numeric,text,text), public.release_launch_hold(text,text), public.consume_launch_hold(text), public.segA_hold_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.launch_wallet_available_minor(text,text), public.get_launch_wallet_available(text,text),
 public.get_launch_source_reserved(text,uuid,text), public.reserve_launch_hold(text,text,numeric,text,text), public.release_launch_hold(text,text), public.consume_launch_hold(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_launch_wallet_available(text,text) TO authenticated;
COMMIT;
