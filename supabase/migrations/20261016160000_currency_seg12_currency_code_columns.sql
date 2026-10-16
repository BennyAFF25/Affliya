-- Additive metadata only; preserve source currency values and constraints.
BEGIN;

ALTER TABLE public.platform_fee_ledger
  ADD COLUMN currency_code text GENERATED ALWAYS AS (upper(currency)) STORED;
COMMENT ON COLUMN public.platform_fee_ledger.currency_code IS
  'Canonical uppercase ISO form for cross-ledger joins; format validity is diagnostic only. Source currency stays lowercase for existing writers; no registry membership is implied.';

ALTER TABLE public.creator_commission_ledger
  ADD COLUMN currency_code text GENERATED ALWAYS AS (upper(currency)) STORED;
COMMENT ON COLUMN public.creator_commission_ledger.currency_code IS
  'Canonical uppercase ISO form for cross-ledger joins; format validity is diagnostic only. Source currency stays lowercase for existing writers; no registry membership is implied.';

ALTER TABLE public.affiliate_launch_fund_allocations
  ADD COLUMN currency_code text GENERATED ALWAYS AS (upper(currency)) STORED;
COMMENT ON COLUMN public.affiliate_launch_fund_allocations.currency_code IS
  'Canonical uppercase ISO form for cross-ledger joins; format validity is diagnostic only. Source currency stays lowercase for existing writers; no registry membership is implied.';

ALTER TABLE public.affiliate_launch_fund_transactions
  ADD COLUMN currency_code text GENERATED ALWAYS AS (upper(currency)) STORED;
COMMENT ON COLUMN public.affiliate_launch_fund_transactions.currency_code IS
  'Canonical uppercase ISO form for cross-ledger joins; format validity is diagnostic only. Source currency stays lowercase for existing writers; no registry membership is implied.';

-- Legacy source constraints allow 3–8 characters: flag format, never reject writes.
CREATE VIEW public.ledger_currency_code_issues WITH (security_invoker = true) AS
SELECT 'platform_fee_ledger'::text AS source_table, id::text AS source_id, currency, currency_code
FROM public.platform_fee_ledger
WHERE currency_code IS NOT NULL AND currency_code !~ '^[A-Z]{3}$'
UNION ALL
SELECT 'creator_commission_ledger'::text AS source_table, id::text AS source_id, currency, currency_code
FROM public.creator_commission_ledger
WHERE currency_code IS NOT NULL AND currency_code !~ '^[A-Z]{3}$'
UNION ALL
SELECT 'affiliate_launch_fund_allocations'::text AS source_table, id::text AS source_id, currency, currency_code
FROM public.affiliate_launch_fund_allocations
WHERE currency_code IS NOT NULL AND currency_code !~ '^[A-Z]{3}$'
UNION ALL
SELECT 'affiliate_launch_fund_transactions'::text AS source_table, id::text AS source_id, currency, currency_code
FROM public.affiliate_launch_fund_transactions
WHERE currency_code IS NOT NULL AND currency_code !~ '^[A-Z]{3}$';
REVOKE ALL ON public.ledger_currency_code_issues FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ledger_currency_code_issues TO service_role;
COMMENT ON VIEW public.ledger_currency_code_issues IS
  'Diagnostic non-ISO-format codes only; does not enforce constraints or verify registry membership.';
COMMIT;
