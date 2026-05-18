CREATE TABLE IF NOT EXISTS public.billable_event_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NULL,
  source_route text NOT NULL,
  reason_code text NOT NULL,
  message text NULL,
  event_type text NULL,
  raw_campaign_id text NULL,
  resolved_campaign_id uuid NULL,
  offer_id uuid NULL,
  affiliate_id text NULL,
  raw_payload jsonb NULL,
  event_snapshot jsonb NULL,
  status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billable_event_quarantine_event_id_unique
  ON public.billable_event_quarantine (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billable_event_quarantine_status_created_idx
  ON public.billable_event_quarantine (status, created_at DESC);
