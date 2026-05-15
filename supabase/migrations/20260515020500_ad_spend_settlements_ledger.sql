CREATE TABLE IF NOT EXISTS public.ad_spend_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_key text NOT NULL,
  live_ad_id uuid NOT NULL REFERENCES public.live_ads(id) ON DELETE CASCADE,
  affiliate_email text NOT NULL,
  business_email text NOT NULL,
  offer_id uuid NULL,
  business_id uuid NULL,
  affiliate_user_id uuid NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  spend numeric(12,2) NOT NULL DEFAULT 0,
  transferred_before numeric(12,2) NOT NULL DEFAULT 0,
  transferred_after numeric(12,2) NOT NULL DEFAULT 0,
  unpaid_before numeric(12,2) NOT NULL DEFAULT 0,
  unpaid_after numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ledger_applied',
  stripe_transfer_id text NULL,
  transfer_batch_id text NULL,
  transfer_retry_count integer NOT NULL DEFAULT 0,
  transfer_error_message text NULL,
  next_retry_at timestamptz NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ad_spend_settlements_settlement_key_unique
  ON public.ad_spend_settlements (settlement_key);

CREATE INDEX IF NOT EXISTS ad_spend_settlements_status_retry_idx
  ON public.ad_spend_settlements (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS ad_spend_settlements_business_email_idx
  ON public.ad_spend_settlements (business_email, created_at DESC);

CREATE INDEX IF NOT EXISTS ad_spend_settlements_affiliate_email_idx
  ON public.ad_spend_settlements (affiliate_email, created_at DESC);

CREATE INDEX IF NOT EXISTS ad_spend_settlements_live_ad_id_idx
  ON public.ad_spend_settlements (live_ad_id, created_at DESC);

ALTER TABLE public.ad_spend_settlements
  ADD COLUMN IF NOT EXISTS offer_id uuid NULL,
  ADD COLUMN IF NOT EXISTS business_id uuid NULL,
  ADD COLUMN IF NOT EXISTS affiliate_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text NULL,
  ADD COLUMN IF NOT EXISTS transfer_batch_id text NULL,
  ADD COLUMN IF NOT EXISTS transfer_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_error_message text NULL,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.ad_spend_settlements
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;
