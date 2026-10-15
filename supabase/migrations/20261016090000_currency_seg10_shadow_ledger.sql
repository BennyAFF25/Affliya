-- Shadow only: existing application balances remain authoritative.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_accounts'::regclass
      AND conname = 'wallet_accounts_id_currency_key') THEN
    ALTER TABLE public.wallet_accounts
      ADD CONSTRAINT wallet_accounts_id_currency_key UNIQUE (id, currency);
  END IF;
END;
$$;

CREATE TABLE public.wallet_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  currency text NOT NULL REFERENCES public.currency_registry(code),
  entry_type text NOT NULL CHECK (entry_type IN ('topup_credit', 'refund_debit', 'deduction_debit', 'hold', 'hold_release', 'adjustment')),
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0),
  source_table text NOT NULL,
  source_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  FOREIGN KEY (account_id, currency) REFERENCES public.wallet_accounts(id, currency),
  UNIQUE (source_table, source_id, entry_type)
);

CREATE TABLE public.wallet_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  currency text NOT NULL REFERENCES public.currency_registry(code),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL CHECK (status IN ('active', 'consumed', 'released')),
  reference_table text NOT NULL,
  reference_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_id, currency) REFERENCES public.wallet_accounts(id, currency)
);

ALTER TABLE public.wallet_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_ledger_entries, public.wallet_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.wallet_ledger_entries, public.wallet_holds TO service_role;

-- One consistent local snapshot, also preventing legacy writes between backfill/assertion.
LOCK TABLE public.wallet_topups, public.wallet_deductions, public.wallet_refunds,
  public.wallet_accounts IN SHARE MODE;

DO $$
DECLARE
  null_currency_count bigint;
  missing_account_count bigint;
BEGIN
  WITH sources AS (
    SELECT affiliate_email, currency FROM public.wallet_topups
    UNION ALL SELECT affiliate_email, currency FROM public.wallet_deductions
    UNION ALL SELECT affiliate_email, currency FROM public.wallet_refunds
  )
  SELECT count(*) FILTER (WHERE s.currency IS NULL),
    count(*) FILTER (WHERE s.currency IS NOT NULL AND a.id IS NULL)
  INTO null_currency_count, missing_account_count
  FROM sources s LEFT JOIN public.wallet_accounts a
    ON a.owner_email = s.affiliate_email AND a.currency = s.currency;
  IF null_currency_count <> 0 OR missing_account_count <> 0 THEN
    RAISE EXCEPTION 'Segment 10 skipped rows: NULL currency %, no matching account %',
      null_currency_count, missing_account_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.wallet_accounts a JOIN public.currency_registry r ON r.code = a.currency
    WHERE r.minor_unit_exponent <> 2
  ) THEN
    RAISE EXCEPTION 'Segment 10 legacy backfill requires two-decimal account currencies';
  END IF;
END;
$$;

-- Math.round compatibility: ties toward positive infinity, not SQL round(numeric).
WITH normalized AS (
  SELECT t.*, a.id AS account_id,
    CASE WHEN credited_amount IS NULL OR credited_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(credited_amount::double precision * 100 + 0.5)::numeric END AS credited,
    CASE WHEN amount_net IS NULL OR amount_net::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(amount_net::double precision * 100 + 0.5)::numeric END AS net,
    CASE WHEN amount_refunded IS NULL OR amount_refunded::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(amount_refunded::double precision * 100 + 0.5)::numeric END AS refunded
  FROM public.wallet_topups t JOIN public.wallet_accounts a
    ON a.owner_email = t.affiliate_email AND a.currency = t.currency
  WHERE COALESCE(lower(t.status), '') IN ('', 'succeeded', 'refunded')
), preferred AS (
  SELECT *, CASE WHEN credited > 0 THEN credited ELSE net END AS principal FROM normalized
), amounts AS (
  SELECT *, greatest(0, principal) AS credit,
    -least(greatest(0, principal), greatest(0, refunded)) AS refund,
    greatest(0, principal - refunded) AS net_available FROM preferred
)
INSERT INTO public.wallet_ledger_entries
  (account_id, currency, entry_type, amount_minor, source_table, source_id, occurred_at, metadata)
SELECT account_id, currency, e.entry_type, e.amount_minor::bigint,
  'wallet_topups', id::text, created_at,
  jsonb_build_object('shadow_snapshot', true, 'refund_rule', 'embedded_only')
FROM amounts CROSS JOIN LATERAL (VALUES
  ('topup_credit', credit), ('refund_debit', refund),
  ('adjustment', net_available - credit - refund)
) e(entry_type, amount_minor)
WHERE e.amount_minor <> 0;

-- wallet_refunds is audit-only: do not subtract again.
INSERT INTO public.wallet_ledger_entries
  (account_id, currency, entry_type, amount_minor, source_table, source_id, occurred_at, metadata)
SELECT a.id, d.currency, 'deduction_debit', -n.minor::bigint,
  'wallet_deductions', d.id::text, d.created_at, '{"shadow_snapshot": true}'::jsonb
FROM public.wallet_deductions d JOIN public.wallet_accounts a
  ON a.owner_email = d.affiliate_email AND a.currency = d.currency
CROSS JOIN LATERAL (SELECT CASE WHEN d.amount IS NULL OR d.amount::text IN ('NaN', 'Infinity', '-Infinity') THEN 0::numeric ELSE floor(d.amount::double precision * 100 + 0.5)::numeric END AS minor) n
WHERE n.minor <> 0;

-- Canonical final availableBalance floor: explicitly preserve, never hide in the view.
INSERT INTO public.wallet_ledger_entries
  (account_id, currency, entry_type, amount_minor, source_table, source_id, occurred_at, metadata)
SELECT a.id, a.currency, 'adjustment', -sum(e.amount_minor)::bigint,
  'wallet_accounts', a.id::text, transaction_timestamp(),
  '{"shadow_snapshot": true, "reason": "canonical_available_floor"}'::jsonb
FROM public.wallet_accounts a JOIN public.wallet_ledger_entries e ON e.account_id = a.id
GROUP BY a.id, a.currency HAVING sum(e.amount_minor) < 0;

DO $$
DECLARE
  ledger_total numeric;
  canonical_total numeric;
BEGIN
  IF EXISTS (
    WITH ledger AS (
      SELECT a.owner_email, COALESCE(sum(e.amount_minor), 0) / 100::numeric AS available
      FROM public.wallet_accounts a LEFT JOIN public.wallet_ledger_entries e ON e.account_id = a.id
      WHERE a.currency = 'AUD' AND a.owner_role = 'affiliate' GROUP BY a.owner_email
    ), canonical AS (
      SELECT affiliate_email, available FROM public.affiliate_wallet_balances_by_currency
      WHERE currency_bucket = 'AUD'
    )
    SELECT 1 FROM ledger l FULL JOIN canonical c ON c.affiliate_email = l.owner_email
    WHERE COALESCE(l.available, 0) <> COALESCE(c.available, 0)
  ) THEN
    RAISE EXCEPTION 'Segment 10 per-affiliate AUD balance mismatch against seg7';
  END IF;
  SELECT COALESCE(sum(e.amount_minor), 0) / 100::numeric INTO ledger_total
  FROM public.wallet_ledger_entries e JOIN public.wallet_accounts a ON a.id = e.account_id
  WHERE a.currency = 'AUD' AND a.owner_role = 'affiliate';
  SELECT COALESCE(sum(available), 0) INTO canonical_total
  FROM public.affiliate_wallet_balances_by_currency WHERE currency_bucket = 'AUD';
  IF ledger_total <> canonical_total THEN
    RAISE EXCEPTION 'Segment 10 total AUD mismatch: ledger %, seg7 %', ledger_total, canonical_total;
  END IF;
END;
$$;

CREATE VIEW public.wallet_ledger_balances WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.owner_email, a.currency,
  COALESCE(e.balance, 0::numeric) AS ledger_balance_minor,
  COALESCE(h.balance, 0::numeric) AS active_holds_minor
FROM public.wallet_accounts a
LEFT JOIN (SELECT account_id, sum(amount_minor) AS balance
  FROM public.wallet_ledger_entries GROUP BY account_id) e ON e.account_id = a.id
LEFT JOIN (SELECT account_id, sum(amount_minor) AS balance
  FROM public.wallet_holds WHERE status = 'active' GROUP BY account_id) h ON h.account_id = a.id;
REVOKE ALL ON public.wallet_ledger_balances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.wallet_ledger_balances TO service_role;
COMMENT ON TABLE public.wallet_ledger_entries IS
  'Shadow, not authoritative. Static backfill snapshot as of migration; no dual-write yet. Signed minor units: credits positive, debits negative; adjustments preserve canonical clamps. Refund audit rows are not debited.';
COMMENT ON TABLE public.wallet_holds IS
  'Shadow, not authoritative. Empty at migration; no runtime reservation or dual-write yet. No lifecycle triggers.';
COMMENT ON VIEW public.wallet_ledger_balances IS
  'Shadow diagnostic, not authoritative. Static backfill snapshot as of migration; no dual-write yet. Holds shown separately, not subtracted from ledger balance.';
COMMIT;
