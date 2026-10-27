-- Persist billing recovery emails independently of payment and subscription ledgers.
-- Apply BEFORE enabling BILLING_RECOVERY_EMAILS_ENABLED. No Stripe state is changed.
CREATE TABLE IF NOT EXISTS public.business_billing_recovery_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('immediate', 'after_48h', 'after_5d')),
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed', 'skipped')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  provider_email_id text NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_invoice_id, stage)
);

CREATE INDEX IF NOT EXISTS business_billing_recovery_emails_business_idx
 ON public.business_billing_recovery_emails (business_id, created_at DESC);

ALTER TABLE public.business_billing_recovery_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_billing_recovery_emails FROM anon, authenticated;
GRANT ALL ON public.business_billing_recovery_emails TO service_role;
-- No authenticated user policies: only server-side service role may read/write.
