# SEG11 rollback-only SQL verification

Not executed by Codex. Run as an operator with DDL privileges on a disposable database copy with SEG7–11 applied. The forced failure briefly adds a ledger constraint and takes a table lock; use an isolated copy. Execute the whole block in one session. Every change, including audit rows and the failure constraint, is rolled back. If a statement fails, issue `ROLLBACK` before doing anything else.

This uses an existing AUD affiliate account with no baseline drift and no active canonical floor, plus an existing offer/business for the deduction's required identity. Review current source constraints before executing: historical schema evidence establishes deduction `offer_id` and `business_email` as NOT NULL. No Stripe or Meta calls occur in this SQL.

```sql
BEGIN;
CREATE TEMP TABLE seg11_probe ON COMMIT DROP AS
SELECT a.id AS account_id, a.owner_email AS email, a.currency,
  r.canonical_minor AS baseline, gen_random_uuid() AS topup_id,
  gen_random_uuid() AS deduction_id, o.id AS offer_id, o.business_email
FROM public.wallet_accounts a
JOIN public.wallet_ledger_reconciliation r
  ON r.affiliate_email = a.owner_email AND r.currency = a.currency
CROSS JOIN LATERAL (
  SELECT id, business_email FROM public.offers
  WHERE business_email IS NOT NULL ORDER BY id LIMIT 1
) o
WHERE a.currency = 'AUD' AND a.owner_role = 'affiliate'
  AND NOT r.has_drift AND NOT r.canonical_floor_applied
  AND NOT r.canonical_missing
ORDER BY a.id LIMIT 1;
DO $$ BEGIN
  ASSERT (SELECT count(*) = 1 FROM seg11_probe), 'Need an existing account and offer fixture';
END $$;

-- Each call checks both the row ledger and reconciliation, then prints a checkpoint.
CREATE FUNCTION pg_temp.seg11_check(stage text, delta numeric, topup_minor numeric,
  deduction_minor numeric, expected_drift numeric DEFAULT 0)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE p record; r record;
BEGIN
  SELECT * INTO STRICT p FROM seg11_probe;
  ASSERT (SELECT COALESCE(sum(amount_minor), 0) FROM public.wallet_ledger_entries
    WHERE source_table = 'wallet_topups' AND source_id = p.topup_id::text) = topup_minor,
    'Unexpected top-up contribution';
  ASSERT (SELECT COALESCE(sum(amount_minor), 0) FROM public.wallet_ledger_entries
    WHERE source_table = 'wallet_deductions' AND source_id = p.deduction_id::text) = deduction_minor,
    'Unexpected deduction contribution';
  SELECT * INTO STRICT r FROM public.wallet_ledger_reconciliation
    WHERE affiliate_email = p.email AND currency = p.currency;
  ASSERT r.canonical_minor = p.baseline + delta, 'Unexpected canonical balance';
  ASSERT r.drift_minor = expected_drift, 'Unexpected drift';
  ASSERT r.has_drift = (expected_drift <> 0), 'Unexpected drift flag';
  RAISE NOTICE '%: canonical %, ledger %, drift %', stage,
    r.canonical_minor, r.ledger_minor, r.drift_minor;
END $$;

INSERT INTO public.wallet_topups
  (id, affiliate_email, currency, currency_source, amount_gross, stripe_fees,
   amount_net, credited_amount, amount_refunded, stripe_id, status, created_at)
SELECT topup_id, email, currency, 'verified', 10, 0, 10, 10, 0,
  'seg11_rollback_' || topup_id::text, 'succeeded', now() FROM seg11_probe;
SELECT pg_temp.seg11_check('insert top-up', 1000, 1000, 0);
SELECT e.entry_type, e.amount_minor FROM public.wallet_ledger_entries e
JOIN seg11_probe p ON e.source_id = p.topup_id::text;

UPDATE public.wallet_topups SET amount_refunded = 2
WHERE id = (SELECT topup_id FROM seg11_probe);
SELECT pg_temp.seg11_check('embedded refund', 800, 800, 0);
-- Expect credit +1000, refund -200; no double subtraction via wallet_refunds.
SELECT e.entry_type, e.amount_minor FROM public.wallet_ledger_entries e
JOIN seg11_probe p ON e.source_id = p.topup_id::text;

-- Idempotent retry must retain the same two ledger rows, never duplicate them.
UPDATE public.wallet_topups SET amount_refunded = amount_refunded
WHERE id = (SELECT topup_id FROM seg11_probe);
SELECT pg_temp.seg11_check('idempotent retry', 800, 800, 0);
DO $$ BEGIN
  ASSERT (SELECT count(*) = 2 FROM public.wallet_ledger_entries
    WHERE source_table = 'wallet_topups'
      AND source_id = (SELECT topup_id::text FROM seg11_probe));
END $$;

INSERT INTO public.wallet_deductions
  (id, affiliate_email, business_email, offer_id, amount, description,
   currency, currency_source, created_at)
SELECT deduction_id, email, business_email, offer_id, 1, 'SEG11 rollback probe',
  currency, 'verified', now() FROM seg11_probe;
SELECT pg_temp.seg11_check('insert deduction', 700, 800, -100);

-- Force a ledger-only CHECK violation on this source. NOT VALID preserves existing
-- rows but checks subsequent writes. Original top-up UPDATE must still succeed.
DO $$ BEGIN
  EXECUTE format('ALTER TABLE public.wallet_ledger_entries ADD CONSTRAINT seg11_probe_fail
    CHECK (source_id <> %L) NOT VALID', (SELECT topup_id::text FROM seg11_probe));
END $$;
UPDATE public.wallet_topups SET amount_refunded = 3
WHERE id = (SELECT topup_id FROM seg11_probe);
DO $$ BEGIN
  ASSERT (SELECT amount_refunded = 3 FROM public.wallet_topups
    WHERE id = (SELECT topup_id FROM seg11_probe)), 'Original write failed';
  ASSERT EXISTS (SELECT 1 FROM public.money_flow_audit_log
    WHERE wallet_topup_id = (SELECT topup_id::text FROM seg11_probe)
      AND event_type = 'shadow_ledger_sync_failed' AND severity = 'warning'
      AND reason_code = 'SHADOW_LEDGER_SYNC_FAILED'
      AND metadata->>'sqlstate' = '23514' AND metadata->>'sqlerrm' IS NOT NULL),
    'Expected sync-failure audit row';
END $$;
SELECT pg_temp.seg11_check('isolated ledger failure', 600, 800, -100, 100);
SELECT event_type, severity, reason_code, metadata FROM public.money_flow_audit_log
WHERE wallet_topup_id = (SELECT topup_id::text FROM seg11_probe);
ALTER TABLE public.wallet_ledger_entries DROP CONSTRAINT seg11_probe_fail;
UPDATE public.wallet_topups SET amount_refunded = amount_refunded
WHERE id = (SELECT topup_id FROM seg11_probe);
SELECT pg_temp.seg11_check('repair via retry', 600, 700, -100);

DELETE FROM public.wallet_deductions WHERE id = (SELECT deduction_id FROM seg11_probe);
SELECT pg_temp.seg11_check('delete deduction', 700, 700, 0);
DELETE FROM public.wallet_topups WHERE id = (SELECT topup_id FROM seg11_probe);
SELECT pg_temp.seg11_check('delete top-up; restored baseline', 0, 0, 0);
ROLLBACK;
```

Additional rollback-only cases: transition succeeded → pending → succeeded; amounts zero/nonfinite/negative and half-cent boundaries; embedded refund above principal; source email/currency/id changes; missing/NULL currency and enabled-account creation; audit-only refund INSERT/UPDATE/DELETE; overdraw beyond available (expect negative ledger plus floor explanation); simultaneous writes to distinct sources and repeated writes to the same source; anon/authenticated denial and service-role view access; deliberately reject both ledger and audit inserts and verify the canonical write survives. Use independent transactions for concurrency tests and roll each back. None of these SQL tests has been run here.
