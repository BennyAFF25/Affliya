BEGIN;

-- Diagnostic mirror of balance.ts: JS Math.round ties toward positive infinity.
CREATE VIEW public.affiliate_wallet_balances_by_currency
WITH (security_invoker = true) AS
WITH normalized_topups AS (
  SELECT affiliate_email, COALESCE(currency, 'UNRECORDED') AS currency_bucket,
    COALESCE(lower(status), '') IN ('', 'succeeded', 'refunded') AS countable,
    CASE WHEN credited_amount IS NULL OR credited_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(credited_amount::double precision * 100 + 0.5)::numeric / 100 END AS credited,
    CASE WHEN amount_net IS NULL OR amount_net::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(amount_net::double precision * 100 + 0.5)::numeric / 100 END AS net,
    CASE WHEN amount_refunded IS NULL OR amount_refunded::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(amount_refunded::double precision * 100 + 0.5)::numeric / 100 END AS refunded
  FROM public.wallet_topups
), topups AS (
  SELECT *, CASE WHEN credited > 0 THEN credited ELSE net END AS preferred
  FROM normalized_topups
), entries AS (
  SELECT affiliate_email, currency_bucket,
    CASE WHEN countable THEN greatest(0, preferred) ELSE 0 END AS credited,
    CASE WHEN countable THEN greatest(0, refunded) ELSE 0 END AS refunded,
    CASE WHEN countable THEN greatest(0, preferred - refunded) ELSE 0 END AS net_available,
    0::numeric AS deducted, 0::numeric AS refund_ledger,
    1::bigint AS topup_count, countable::integer AS countable_topup_count,
    0::bigint AS deduction_count, 0::bigint AS refund_count
  FROM topups
  UNION ALL
  SELECT affiliate_email, COALESCE(currency, 'UNRECORDED'), 0, 0, 0,
    CASE WHEN amount IS NULL OR amount::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(amount::double precision * 100 + 0.5)::numeric / 100 END, 0, 0, 0, 1, 0
  FROM public.wallet_deductions
  UNION ALL
  -- Audit only: already embedded in wallet_topups.amount_refunded.
  SELECT affiliate_email, COALESCE(currency, 'UNRECORDED'), 0, 0, 0, 0,
    CASE WHEN amount IS NULL OR amount::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(amount::double precision * 100 + 0.5)::numeric / 100 END, 0, 0, 0, 1
  FROM public.wallet_refunds WHERE status = 'succeeded'
)
SELECT affiliate_email, currency_bucket,
  sum(credited)::numeric AS credited_total,
  sum(refunded)::numeric AS refunded_total,
  sum(deducted)::numeric AS deducted_total,
  sum(net_available)::numeric AS topups_net_available,
  sum(refund_ledger)::numeric AS refund_ledger_total,
  greatest(0, sum(net_available) - sum(deducted))::numeric AS available,
  sum(topup_count)::bigint AS topup_count,
  sum(countable_topup_count)::bigint AS countable_topup_count,
  sum(deduction_count)::bigint AS deduction_count,
  sum(refund_count)::bigint AS refund_count,
  bool_or(currency_bucket = 'UNRECORDED') AS has_unrecorded
FROM entries GROUP BY affiliate_email, currency_bucket;

CREATE VIEW public.affiliate_pending_spend_by_currency
WITH (security_invoker = true) AS
WITH ads AS (
  SELECT affiliate_email, COALESCE(currency, 'UNRECORDED') AS currency_bucket,
    greatest(0, (CASE WHEN spend IS NULL OR spend::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(spend::double precision * 100 + 0.5)::numeric / 100 END) - (CASE WHEN spend_transferred IS NULL OR spend_transferred::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(spend_transferred::double precision * 100 + 0.5)::numeric / 100 END)) AS unpaid,
    (COALESCE(lower(status), '') IN ('active', 'live') OR
     COALESCE(lower(billing_state), '') IN ('active', 'live')) AS active
  FROM public.live_ads
)
SELECT affiliate_email, currency_bucket, sum(unpaid)::numeric AS pending_unpaid_spend,
  count(*) AS ad_count, count(*) FILTER (WHERE unpaid > 0) AS unpaid_ad_count,
  count(*) FILTER (WHERE active) AS active_ad_count,
  bool_or(currency_bucket = 'UNRECORDED') AS has_unrecorded
FROM ads GROUP BY affiliate_email, currency_bucket;

REVOKE ALL ON public.affiliate_wallet_balances_by_currency FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.affiliate_pending_spend_by_currency FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.affiliate_wallet_balances_by_currency TO service_role;
GRANT SELECT ON public.affiliate_pending_spend_by_currency TO service_role;
COMMENT ON VIEW public.affiliate_wallet_balances_by_currency IS
  'Diagnostic/read-only currency buckets; not authoritative yet. Refund ledger is audit-only. No FX or inferred currency.';
COMMENT ON VIEW public.affiliate_pending_spend_by_currency IS
  'Diagnostic/read-only pending spend by currency; not authoritative yet. All ad statuses included; not a reservation or ledger debit.';

COMMIT;
