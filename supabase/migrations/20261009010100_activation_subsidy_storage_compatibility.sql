-- Storage compatibility only: NO automatic grants/triggers/backfill.
-- The August migration enables a legacy automatic A$10 programme.
-- Do not run that migration simply to restore these reads.
CREATE TABLE IF NOT EXISTS public.business_activation_subsidies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NULL REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  business_email text NOT NULL,
  offer_id uuid NULL REFERENCES public.offers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'awaiting_subscription' CHECK (
    status IN (
      'awaiting_subscription',
      'available',
      'reserved',
      'partially_consumed',
      'consumed',
      'settled',
      'expired',
      'cancelled'
    )
  ),
  subsidy_amount numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (subsidy_amount >= 0),
  consumed_amount numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (consumed_amount >= 0),
  reserved_for_affiliate_email text NULL,
  consumed_by_affiliate_email text NULL,
  approved_request_id uuid NULL,
  live_ad_id uuid NULL REFERENCES public.live_ads(id) ON DELETE SET NULL,
  subscription_id text NULL,
  reserved_at timestamptz NULL,
  consumed_at timestamptz NULL,
  settled_at timestamptz NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_activation_subsidies_consumption_limit_check CHECK (consumed_amount <= subsidy_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS business_activation_subsidies_business_email_key
  ON public.business_activation_subsidies (business_email);

CREATE UNIQUE INDEX IF NOT EXISTS business_activation_subsidies_offer_id_key
  ON public.business_activation_subsidies (offer_id)
  WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_activation_subsidies_status_idx
  ON public.business_activation_subsidies (status);

CREATE INDEX IF NOT EXISTS business_activation_subsidies_reserved_affiliate_idx
  ON public.business_activation_subsidies (reserved_for_affiliate_email)
  WHERE reserved_for_affiliate_email IS NOT NULL;


ALTER TABLE public.business_activation_subsidies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activation_subsidy_owner_select ON public.business_activation_subsidies;
CREATE POLICY activation_subsidy_owner_select ON public.business_activation_subsidies FOR SELECT TO authenticated USING(
 business_email=auth.email() OR reserved_for_affiliate_email=auth.email()
 OR (status='available' AND EXISTS(SELECT 1 FROM public.offers o WHERE o.id=business_activation_subsidies.offer_id AND COALESCE(o.participation_mode,'open') <> 'private'))
);
REVOKE ALL ON public.business_activation_subsidies FROM anon,authenticated;
GRANT SELECT ON public.business_activation_subsidies TO authenticated;
GRANT ALL ON public.business_activation_subsidies TO service_role;
NOTIFY pgrst,'reload schema';
