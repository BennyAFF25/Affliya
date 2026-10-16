BEGIN;
DROP VIEW IF EXISTS public.ledger_currency_code_issues;
ALTER TABLE public.platform_fee_ledger DROP COLUMN IF EXISTS currency_code;
ALTER TABLE public.creator_commission_ledger DROP COLUMN IF EXISTS currency_code;
ALTER TABLE public.affiliate_launch_fund_allocations DROP COLUMN IF EXISTS currency_code;
ALTER TABLE public.affiliate_launch_fund_transactions DROP COLUMN IF EXISTS currency_code;
COMMIT;
