-- Transactional notification outbox. Production migration is reviewed/applied at release, not now.
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  event_type text not null,
  account_scope text not null check (account_scope in ('subscription','platform','product')),
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','sent','cancelled','dead')),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  provider_message_id text,
  delivery_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (event_key, recipient)
);
create index if not exists notification_outbox_due_idx on public.notification_outbox (available_at,created_at) where status in ('queued','processing');
create index if not exists notification_outbox_provider_idx on public.notification_outbox (provider_message_id) where provider_message_id is not null;
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
grant select, insert, update on public.notification_outbox to service_role;

create table if not exists public.notification_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_message_id text not null,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.notification_delivery_events enable row level security;
revoke all on public.notification_delivery_events from anon, authenticated;
grant select, insert on public.notification_delivery_events to service_role;

-- Claims rows atomically, including jobs abandoned for 15 minutes. Only service_role can invoke.
create or replace function public.notification_claim_batch(batch_size integer default 15)
returns setof public.notification_outbox
language sql security invoker set search_path = ''
as $$
  with picked as (
    select id from public.notification_outbox
    where ((status = 'queued' and available_at <= now())
       or (status = 'processing' and updated_at < now() - interval '15 minutes'))
      and attempt_count < 6
    order by available_at, created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 50)
  )
  update public.notification_outbox n set
    status = 'processing', attempt_count = n.attempt_count + 1, updated_at = now()
  from picked where picked.id = n.id
  returning n.*;
$$;
revoke execute on function public.notification_claim_batch(integer) from public, anon, authenticated;
grant execute on function public.notification_claim_batch(integer) to service_role;
