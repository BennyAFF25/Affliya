-- Billing notification send ledger (trial started, receipts, cancellation,
-- non-payment cancellation, refund). The Stripe webhook enqueues rows; the
-- billing-notifications cron sends them. One row per (Stripe object, kind)
-- makes webhook replays and cron retries safe. Additive only. Service role only.
-- Undo: supabase/undo/20261127121000_business_billing_notifications.undo.sql
create table if not exists public.business_billing_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  kind text not null check (kind in ('trial_started','trial_converted','payment_receipt','subscription_cancel_scheduled','subscription_ended','cancelled_nonpayment','refund')),
  stripe_object_id text not null,
  stripe_subscription_id text null,
  recipient_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  claimed_at timestamptz null,
  sent_at timestamptz null,
  provider_email_id text null,
  last_error text null,
  created_at timestamptz not null default now(),
  unique (stripe_object_id, kind)
);
create index if not exists business_billing_notifications_status_idx
  on public.business_billing_notifications (status, created_at);
create index if not exists business_billing_notifications_business_idx
  on public.business_billing_notifications (business_id, created_at desc);
create index if not exists business_billing_notifications_subscription_idx
  on public.business_billing_notifications (stripe_subscription_id, kind);
alter table public.business_billing_notifications enable row level security;
revoke all on public.business_billing_notifications from anon, authenticated;
grant all on public.business_billing_notifications to service_role;
-- No authenticated user policies: only server-side service role may read/write.
