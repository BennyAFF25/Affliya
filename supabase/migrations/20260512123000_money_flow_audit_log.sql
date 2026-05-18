CREATE TABLE IF NOT EXISTS public.money_flow_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  source_route text NOT NULL,
  entity_type text NULL,
  entity_id text NULL,
  business_email text NULL,
  affiliate_email text NULL,
  business_id text NULL,
  affiliate_user_id text NULL,
  offer_id text NULL,
  campaign_id text NULL,
  live_ad_id text NULL,
  payout_id text NULL,
  wallet_topup_id text NULL,
  wallet_refund_id text NULL,
  wallet_deduction_id text NULL,
  reason_code text NULL,
  message text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS money_flow_audit_log_created_idx
  ON public.money_flow_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS money_flow_audit_log_event_type_created_idx
  ON public.money_flow_audit_log (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS money_flow_audit_log_payout_created_idx
  ON public.money_flow_audit_log (payout_id, created_at DESC)
  WHERE payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS money_flow_audit_log_live_ad_created_idx
  ON public.money_flow_audit_log (live_ad_id, created_at DESC)
  WHERE live_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS money_flow_audit_log_affiliate_created_idx
  ON public.money_flow_audit_log (affiliate_email, created_at DESC)
  WHERE affiliate_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS money_flow_audit_log_business_created_idx
  ON public.money_flow_audit_log (business_email, created_at DESC)
  WHERE business_email IS NOT NULL;
