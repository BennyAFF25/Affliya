BEGIN;
DROP FUNCTION public.settle_live_ad_spend(uuid,numeric,numeric,numeric,numeric,uuid,numeric,text,numeric,text,date);
CREATE OR REPLACE FUNCTION public.launch_wallet_available_minor(p_affiliate_email text, p_exclude_reference_id text DEFAULT NULL)
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

COMMIT;
