-- Segment 3: dormant registry only; no existing tables or runtime paths change.
BEGIN;

CREATE TABLE IF NOT EXISTS public.currency_registry (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  name text NOT NULL,
  minor_unit_exponent smallint NOT NULL CHECK (minor_unit_exponent BETWEEN 0 AND 4),
  symbol text,
  offer_display_enabled bool NOT NULL DEFAULT false,
  topup_enabled bool NOT NULL DEFAULT false,
  wallet_enabled bool NOT NULL DEFAULT false,
  meta_launch_enabled bool NOT NULL DEFAULT false,
  commission_enabled bool NOT NULL DEFAULT false,
  payout_enabled bool NOT NULL DEFAULT false,
  refund_enabled bool NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.currency_registry (
  code, name, minor_unit_exponent, symbol,
  offer_display_enabled, topup_enabled, wallet_enabled, meta_launch_enabled, commission_enabled, payout_enabled, refund_enabled, notes
) VALUES
  ('AUD', 'Australian Dollar', 2, 'A$', true, true, true, true, true, true, true, 'AUD-only containment; all capabilities enabled.'),
  ('USD', 'US Dollar', 2, 'US$', true, false, false, false, false, false, false, 'Display only; money capabilities fail closed.'),
  ('GBP', 'Pound Sterling', 2, '£', true, false, false, false, false, false, false, 'Display only; money capabilities fail closed.'),
  ('CAD', 'Canadian Dollar', 2, 'CA$', true, false, false, false, false, false, false, 'Display only; money capabilities fail closed.'),
  ('EUR', 'Euro', 2, '€', true, false, false, false, false, false, false, 'Display only; money capabilities fail closed.'),
  ('NZD', 'New Zealand Dollar', 2, 'NZ$', true, false, false, false, false, false, false, 'Display only; money capabilities fail closed.'),
  ('TRY', 'Turkish Lira', 2, '₺', true, false, false, false, false, false, false, 'Display only; money capabilities fail closed.'),
  ('JPY', 'Japanese Yen', 0, '¥', true, false, false, false, false, false, false, 'Display only; money capabilities fail closed.')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.currency_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS currency_registry_select ON public.currency_registry;
CREATE POLICY currency_registry_select ON public.currency_registry
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.currency_registry IS
  'Preparatory currency capabilities: unknown codes and disabled flags fail closed. Display support does not enable money movement. No runtime consumers yet; no foreign keys or backfill. RLS permits public reads only; writes require service role.';
COMMENT ON COLUMN public.currency_registry.code IS
  'Uppercase three-letter ISO 4217 code; absent codes must fail closed.';
COMMENT ON COLUMN public.currency_registry.name IS
  'Human-readable currency name; not evidence of money support.';
COMMENT ON COLUMN public.currency_registry.minor_unit_exponent IS
  'ISO minor-unit exponent from 0 to 4; metadata only, no amount conversion.';
COMMENT ON COLUMN public.currency_registry.symbol IS
  'Optional display symbol; code remains the currency identity.';
COMMENT ON COLUMN public.currency_registry.notes IS
  'Capability rationale; display-only currencies do not permit money movement.';
COMMENT ON COLUMN public.currency_registry.created_at IS
  'Registry creation timestamp.';
COMMENT ON COLUMN public.currency_registry.updated_at IS
  'Registry update timestamp; future writers must maintain this value, no update trigger.';
COMMENT ON COLUMN public.currency_registry.offer_display_enabled IS
  'Explicit offer display permission only; false or unknown currency fails closed.';
COMMENT ON COLUMN public.currency_registry.topup_enabled IS
  'Explicit topup capability; defaults false and unknown currencies fail closed. Not runtime enforcement yet.';
COMMENT ON COLUMN public.currency_registry.wallet_enabled IS
  'Explicit wallet capability; defaults false and unknown currencies fail closed. Not runtime enforcement yet.';
COMMENT ON COLUMN public.currency_registry.meta_launch_enabled IS
  'Explicit meta launch capability; defaults false and unknown currencies fail closed. Not runtime enforcement yet.';
COMMENT ON COLUMN public.currency_registry.commission_enabled IS
  'Explicit commission capability; defaults false and unknown currencies fail closed. Not runtime enforcement yet.';
COMMENT ON COLUMN public.currency_registry.payout_enabled IS
  'Explicit payout capability; defaults false and unknown currencies fail closed. Not runtime enforcement yet.';
COMMENT ON COLUMN public.currency_registry.refund_enabled IS
  'Explicit refund capability; defaults false and unknown currencies fail closed. Not runtime enforcement yet.';

COMMIT;
