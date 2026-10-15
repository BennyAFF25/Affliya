-- Removes Segment 2 metadata; any subsequently recorded values would be lost.
BEGIN;

ALTER TABLE public.wallet_topups
  DROP CONSTRAINT IF EXISTS wallet_topups_currency_format_chk,
  DROP CONSTRAINT IF EXISTS wallet_topups_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.wallet_refunds
  DROP CONSTRAINT IF EXISTS wallet_refunds_currency_format_chk,
  DROP CONSTRAINT IF EXISTS wallet_refunds_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.wallet_deductions
  DROP CONSTRAINT IF EXISTS wallet_deductions_currency_format_chk,
  DROP CONSTRAINT IF EXISTS wallet_deductions_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.wallet_payouts
  DROP CONSTRAINT IF EXISTS wallet_payouts_currency_format_chk,
  DROP CONSTRAINT IF EXISTS wallet_payouts_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_currency_format_chk,
  DROP CONSTRAINT IF EXISTS wallets_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.ad_spend_settlements
  DROP CONSTRAINT IF EXISTS ad_spend_settlements_currency_format_chk,
  DROP CONSTRAINT IF EXISTS ad_spend_settlements_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.live_ads
  DROP CONSTRAINT IF EXISTS live_ads_currency_format_chk,
  DROP CONSTRAINT IF EXISTS live_ads_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.conversions
  DROP CONSTRAINT IF EXISTS conversions_currency_format_chk,
  DROP CONSTRAINT IF EXISTS conversions_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.recurring_commission_instances
  DROP CONSTRAINT IF EXISTS recurring_commission_instances_currency_format_chk,
  DROP CONSTRAINT IF EXISTS recurring_commission_instances_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

ALTER TABLE public.business_activation_subsidies
  DROP CONSTRAINT IF EXISTS business_activation_subsidies_currency_format_chk,
  DROP CONSTRAINT IF EXISTS business_activation_subsidies_currency_source_chk,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS currency_source;

COMMIT;
