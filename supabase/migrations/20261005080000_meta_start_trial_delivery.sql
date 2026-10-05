-- Reporting only: no billing, entitlement, or campaign behaviour changes.
BEGIN;
CREATE TABLE public.meta_start_trial_delivery (
  business_id uuid PRIMARY KEY REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,
  stripe_event_id text NOT NULL,
  event_id text NOT NULL UNIQUE,
  event_time bigint NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','expired')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_start_trial_event_check CHECK (payload->>'event_name' = 'StartTrial' AND payload->>'event_id' = event_id)
);
ALTER TABLE public.meta_start_trial_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_start_trial_delivery FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.meta_start_trial_delivery TO service_role;
CREATE POLICY meta_start_trial_service_all ON public.meta_start_trial_delivery FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX meta_start_trial_pending_idx ON public.meta_start_trial_delivery(next_attempt_at) WHERE status IN ('pending','sending');

CREATE FUNCTION public.claim_meta_start_trial_delivery(p_business_id uuid DEFAULT NULL)
RETURNS SETOF public.meta_start_trial_delivery
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Keep ambiguous acknowledgement retries inside Meta's deduplication window.
  UPDATE public.meta_start_trial_delivery
     SET status = 'expired', lease_token = NULL, lease_until = NULL, last_error = 'delivery_window_expired'
   WHERE status IN ('pending','sending')
     AND (to_timestamp(event_time) < now() - interval '6 days'
       OR first_attempt_at < now() - interval '24 hours');
  RETURN QUERY
  WITH candidates AS (
    SELECT business_id FROM public.meta_start_trial_delivery
    WHERE (p_business_id IS NULL OR business_id = p_business_id)
      AND ((status = 'pending' AND next_attempt_at <= now())
        OR (status = 'sending' AND lease_until <= now()))
    ORDER BY next_attempt_at
    FOR UPDATE SKIP LOCKED LIMIT 5
  )
  UPDATE public.meta_start_trial_delivery AS delivery
     SET status = 'sending', attempts = delivery.attempts + 1,
         first_attempt_at = coalesce(delivery.first_attempt_at, now()),
         lease_token = gen_random_uuid(), lease_until = now() + interval '2 minutes'
    FROM candidates
   WHERE delivery.business_id = candidates.business_id
  RETURNING delivery.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_meta_start_trial_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_start_trial_delivery(uuid) TO service_role;
COMMIT;
