create table if not exists public.marketing_site_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view', 'create_account_start')),
  page_path text not null,
  audience text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketing_site_events_event_type_idx
  on public.marketing_site_events (event_type);

create index if not exists marketing_site_events_page_path_idx
  on public.marketing_site_events (page_path);

create index if not exists marketing_site_events_created_at_idx
  on public.marketing_site_events (created_at desc);

alter table public.marketing_site_events enable row level security;
