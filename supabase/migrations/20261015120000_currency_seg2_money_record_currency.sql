-- Segment 2: nullable denomination metadata only; existing rows remain unclassified.
BEGIN;

ALTER TABLE public.wallet_topups
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_topups'::regclass
      AND conname = 'wallet_topups_currency_format_chk'
  ) THEN
    ALTER TABLE public.wallet_topups
      ADD CONSTRAINT wallet_topups_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_topups'::regclass
      AND conname = 'wallet_topups_currency_source_chk'
  ) THEN
    ALTER TABLE public.wallet_topups
      ADD CONSTRAINT wallet_topups_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.wallet_topups.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.wallet_topups.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.wallet_refunds
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_refunds'::regclass
      AND conname = 'wallet_refunds_currency_format_chk'
  ) THEN
    ALTER TABLE public.wallet_refunds
      ADD CONSTRAINT wallet_refunds_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_refunds'::regclass
      AND conname = 'wallet_refunds_currency_source_chk'
  ) THEN
    ALTER TABLE public.wallet_refunds
      ADD CONSTRAINT wallet_refunds_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.wallet_refunds.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.wallet_refunds.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.wallet_deductions
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_deductions'::regclass
      AND conname = 'wallet_deductions_currency_format_chk'
  ) THEN
    ALTER TABLE public.wallet_deductions
      ADD CONSTRAINT wallet_deductions_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_deductions'::regclass
      AND conname = 'wallet_deductions_currency_source_chk'
  ) THEN
    ALTER TABLE public.wallet_deductions
      ADD CONSTRAINT wallet_deductions_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.wallet_deductions.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.wallet_deductions.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.wallet_payouts
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_payouts'::regclass
      AND conname = 'wallet_payouts_currency_format_chk'
  ) THEN
    ALTER TABLE public.wallet_payouts
      ADD CONSTRAINT wallet_payouts_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallet_payouts'::regclass
      AND conname = 'wallet_payouts_currency_source_chk'
  ) THEN
    ALTER TABLE public.wallet_payouts
      ADD CONSTRAINT wallet_payouts_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.wallet_payouts.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.wallet_payouts.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallets'::regclass
      AND conname = 'wallets_currency_format_chk'
  ) THEN
    ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wallets'::regclass
      AND conname = 'wallets_currency_source_chk'
  ) THEN
    ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.wallets.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.wallets.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.ad_spend_settlements
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_spend_settlements'::regclass
      AND conname = 'ad_spend_settlements_currency_format_chk'
  ) THEN
    ALTER TABLE public.ad_spend_settlements
      ADD CONSTRAINT ad_spend_settlements_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_spend_settlements'::regclass
      AND conname = 'ad_spend_settlements_currency_source_chk'
  ) THEN
    ALTER TABLE public.ad_spend_settlements
      ADD CONSTRAINT ad_spend_settlements_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.ad_spend_settlements.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.ad_spend_settlements.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.live_ads
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.live_ads'::regclass
      AND conname = 'live_ads_currency_format_chk'
  ) THEN
    ALTER TABLE public.live_ads
      ADD CONSTRAINT live_ads_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.live_ads'::regclass
      AND conname = 'live_ads_currency_source_chk'
  ) THEN
    ALTER TABLE public.live_ads
      ADD CONSTRAINT live_ads_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.live_ads.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.live_ads.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.conversions
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.conversions'::regclass
      AND conname = 'conversions_currency_format_chk'
  ) THEN
    ALTER TABLE public.conversions
      ADD CONSTRAINT conversions_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.conversions'::regclass
      AND conname = 'conversions_currency_source_chk'
  ) THEN
    ALTER TABLE public.conversions
      ADD CONSTRAINT conversions_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.conversions.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.conversions.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.recurring_commission_instances
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.recurring_commission_instances'::regclass
      AND conname = 'recurring_commission_instances_currency_format_chk'
  ) THEN
    ALTER TABLE public.recurring_commission_instances
      ADD CONSTRAINT recurring_commission_instances_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.recurring_commission_instances'::regclass
      AND conname = 'recurring_commission_instances_currency_source_chk'
  ) THEN
    ALTER TABLE public.recurring_commission_instances
      ADD CONSTRAINT recurring_commission_instances_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.recurring_commission_instances.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.recurring_commission_instances.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

ALTER TABLE public.business_activation_subsidies
  ADD COLUMN IF NOT EXISTS currency text NULL,
  ADD COLUMN IF NOT EXISTS currency_source text NULL;

DO $currency_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.business_activation_subsidies'::regclass
      AND conname = 'business_activation_subsidies_currency_format_chk'
  ) THEN
    ALTER TABLE public.business_activation_subsidies
      ADD CONSTRAINT business_activation_subsidies_currency_format_chk
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.business_activation_subsidies'::regclass
      AND conname = 'business_activation_subsidies_currency_source_chk'
  ) THEN
    ALTER TABLE public.business_activation_subsidies
      ADD CONSTRAINT business_activation_subsidies_currency_source_chk
      CHECK (currency_source IS NULL OR currency_source IN ('verified','inferred','unresolved'));
  END IF;
END;
$currency_constraints$;

COMMENT ON COLUMN public.business_activation_subsidies.currency IS
  'ISO 4217 code of the amount columns on this row; NULL = not yet recorded; set by future segments.';
COMMENT ON COLUMN public.business_activation_subsidies.currency_source IS
  'Provenance of the ISO 4217 code of the amount columns on this row: verified, inferred, or unresolved; NULL = not yet recorded; set by future segments.';

COMMIT;
