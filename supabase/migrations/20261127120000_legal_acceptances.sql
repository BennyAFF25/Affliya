-- Terms v2: append-only, evidence-grade record of terms acceptance (version,
-- time, IP, user agent, linked to Stripe). Additive only. Service role only.
-- Undo: supabase/undo/20261127120000_legal_acceptances.undo.sql (export rows first: legal evidence).
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid null references public.business_profiles(id) on delete set null,
  document text not null check (document in ('terms','privacy')),
  version text not null,
  context text not null check (context in ('signup','trial_start','paid_start','modal')),
  summary_text text null,          -- exact summary/checkbox text shown, with dates filled in
  ip inet null,
  user_agent text null,
  stripe_checkout_session_id text null,
  stripe_subscription_id text null,
  accepted_at timestamptz not null default now()
);
create index if not exists legal_acceptances_user_idx on public.legal_acceptances (user_id, accepted_at desc);
create index if not exists legal_acceptances_business_idx on public.legal_acceptances (business_id, accepted_at desc);
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;
grant all on public.legal_acceptances to service_role;
-- No authenticated policies: only server routes (service role) read or write.

alter table public.profiles add column if not exists terms_version text null;
