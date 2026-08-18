ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS recurring_term_months integer,
  ADD COLUMN IF NOT EXISTS recurring_monthly_commission_value numeric;

CREATE TABLE IF NOT EXISTS public.recurring_commission_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  business_email text NOT NULL,
  affiliate_email text NOT NULL,
  customer_reference text,
  term_months integer NOT NULL CHECK (term_months > 0),
  monthly_commission_amount numeric NOT NULL CHECK (monthly_commission_amount > 0),
  payout_mode text NOT NULL CHECK (payout_mode IN ('upfront', 'spread')),
  payout_interval text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  current_cycle integer NOT NULL DEFAULT 0 CHECK (current_cycle >= 0),
  next_payout_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_commission_instances ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS recurring_commission_instances_source_event_id_key
  ON public.recurring_commission_instances (source_event_id);

CREATE INDEX IF NOT EXISTS recurring_commission_instances_business_email_idx
  ON public.recurring_commission_instances (business_email, status, created_at DESC);

ALTER TABLE public.wallet_payouts
  ADD COLUMN IF NOT EXISTS recurring_instance_id uuid,
  ADD COLUMN IF NOT EXISTS recurring_term_months integer,
  ADD COLUMN IF NOT EXISTS recurring_payout_mode text,
  ADD COLUMN IF NOT EXISTS recurring_payout_interval text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'wallet_payouts'
      AND constraint_name = 'wallet_payouts_recurring_instance_id_fkey'
  ) THEN
    ALTER TABLE public.wallet_payouts
      ADD CONSTRAINT wallet_payouts_recurring_instance_id_fkey
      FOREIGN KEY (recurring_instance_id)
      REFERENCES public.recurring_commission_instances (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wallet_payouts_recurring_instance_id_idx
  ON public.wallet_payouts (recurring_instance_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recurring_commission_instances'
      AND policyname = 'Businesses can view their recurring commission instances'
  ) THEN
    CREATE POLICY "Businesses can view their recurring commission instances"
      ON public.recurring_commission_instances
      FOR SELECT
      USING (business_email = auth.email());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recurring_commission_instances'
      AND policyname = 'Businesses can update their recurring commission instances'
  ) THEN
    CREATE POLICY "Businesses can update their recurring commission instances"
      ON public.recurring_commission_instances
      FOR UPDATE
      USING (business_email = auth.email())
      WITH CHECK (business_email = auth.email());
  END IF;
END $$;
