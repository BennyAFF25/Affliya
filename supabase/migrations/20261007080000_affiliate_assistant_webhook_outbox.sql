-- Durable outbound events for the Grok Bot affiliate assistant.
-- Network delivery stays outside database transactions; triggers only enqueue local descriptors.

create schema if not exists private;

create table if not exists public.affiliate_webhook_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique default ('evt_' || replace(gen_random_uuid()::text, '-', '')),
  event_type text not null,
  business_id uuid null,
  business_email text null,
  offer_id uuid null,
  affiliate_email text null,
  entity_id text null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text null unique,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'delivered', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid null,
  lease_until timestamptz null,
  last_attempt_at timestamptz null,
  delivered_at timestamptz null,
  last_http_status integer null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliate_webhook_outbox enable row level security;
revoke all on table public.affiliate_webhook_outbox from anon, authenticated;

create index if not exists affiliate_webhook_outbox_pending_idx
  on public.affiliate_webhook_outbox (status, next_attempt_at, created_at)
  where status in ('pending', 'sending');

create or replace function private.queue_affiliate_webhook_event(
  p_event_type text,
  p_business_id uuid default null,
  p_business_email text default null,
  p_offer_id uuid default null,
  p_affiliate_email text default null,
  p_entity_id text default null,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.affiliate_webhook_outbox (
    event_type, business_id, business_email, offer_id, affiliate_email,
    entity_id, data, dedupe_key
  )
  values (
    p_event_type, p_business_id, nullif(lower(trim(p_business_email)), ''),
    p_offer_id, nullif(lower(trim(p_affiliate_email)), ''),
    p_entity_id, coalesce(p_data, '{}'::jsonb), p_dedupe_key
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null and p_dedupe_key is not null then
    select id into v_id
    from public.affiliate_webhook_outbox
    where dedupe_key = p_dedupe_key
    limit 1;
  end if;

  return v_id;
end;
$$;

revoke execute on function private.queue_affiliate_webhook_event(text, uuid, text, uuid, text, text, jsonb, text)
  from public, anon, authenticated;

create or replace function private.capture_affiliate_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  j_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  v_business_id uuid;
  v_business_email text;
  v_affiliate_email text;
  v_offer_id uuid;
  v_changed jsonb := '[]'::jsonb;
  v_old_plan text;
  v_new_plan text;
begin
  if tg_table_name = 'business_profiles' then
    v_business_id := nullif(j_new->>'id', '')::uuid;
    v_business_email := j_new->>'business_email';

    if tg_op = 'INSERT' then
      perform private.queue_affiliate_webhook_event(
        'brand.signed_up', v_business_id, v_business_email, null, null,
        j_new->>'id',
        jsonb_build_object('signup_source', null, 'category', null),
        'brand.signed_up:' || coalesce(j_new->>'id', v_business_email)
      );
    elsif tg_op = 'UPDATE' then
      select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
      into v_changed
      from jsonb_object_keys(j_new) key
      where key = any(array['business_name','country','avatar_url'])
        and j_old->key is distinct from j_new->key;

      if jsonb_array_length(v_changed) > 0 then
        perform private.queue_affiliate_webhook_event(
          'brand.profile_updated', v_business_id, v_business_email, null, null,
          j_new->>'id',
          jsonb_build_object('changed_fields', v_changed),
          null
        );
      end if;
    end if;

  elsif tg_table_name = 'offers' then
    v_business_email := case when tg_op = 'DELETE' then j_old->>'business_email' else j_new->>'business_email' end;
    v_offer_id := nullif(case when tg_op = 'DELETE' then j_old->>'id' else j_new->>'id' end, '')::uuid;
    select bp.id into v_business_id
      from public.business_profiles bp
      where lower(bp.business_email) = lower(v_business_email)
      limit 1;

    if tg_op = 'INSERT' then
      perform private.queue_affiliate_webhook_event(
        'offer.created', v_business_id, v_business_email, v_offer_id, null,
        j_new->>'id', '{}'::jsonb, 'offer.created:' || (j_new->>'id')
      );
    elsif tg_op = 'UPDATE' then
      select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
      into v_changed
      from jsonb_object_keys(j_new) key
      where key <> 'created_at'
        and j_old->key is distinct from j_new->key;

      if jsonb_array_length(v_changed) > 0 then
        perform private.queue_affiliate_webhook_event(
          'offer.updated', v_business_id, v_business_email, v_offer_id, null,
          j_new->>'id', jsonb_build_object('changed_fields', v_changed), null
        );
      end if;
    end if;

  elsif tg_table_name = 'meta_connections' then
    v_business_email := case when tg_op = 'DELETE' then j_old->>'business_email' else j_new->>'business_email' end;
    select bp.id into v_business_id
      from public.business_profiles bp
      where lower(bp.business_email) = lower(v_business_email)
      limit 1;

    if tg_op = 'DELETE' then
      perform private.queue_affiliate_webhook_event(
        'meta.disconnected', v_business_id, v_business_email, null, null,
        j_old->>'id', '{}'::jsonb,
        'meta.disconnected:' || v_business_email || ':' || txid_current()::text
      );
    elsif tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and (
         j_old->>'access_token' is distinct from j_new->>'access_token'
         or j_old->>'ad_account_id' is distinct from j_new->>'ad_account_id'
         or j_old->>'page_id' is distinct from j_new->>'page_id'
       )) then
      perform private.queue_affiliate_webhook_event(
        'meta.connected', v_business_id, v_business_email, null, null,
        j_new->>'id',
        jsonb_build_object(
          'ad_account_id', j_new->>'ad_account_id',
          'page_id', j_new->>'page_id',
          'page_name', j_new->>'page_name'
        ),
        'meta.connected:' || v_business_email || ':' || txid_current()::text
      );
    end if;

  elsif tg_table_name = 'business_entitlements' and tg_op = 'UPDATE' then
    v_business_id := nullif(j_new->>'business_id', '')::uuid;
    v_business_email := j_new->>'business_email';
    v_old_plan := case when coalesce(j_old->>'billing_status','') in ('subscription_active','subscription_trialing','subscription_past_due','subscription_unpaid','subscription_incomplete') then 'growth' else 'free' end;
    v_new_plan := case when coalesce(j_new->>'billing_status','') in ('subscription_active','subscription_trialing','subscription_past_due','subscription_unpaid','subscription_incomplete') then 'growth' else 'free' end;

    if v_old_plan is distinct from v_new_plan then
      perform private.queue_affiliate_webhook_event(
        case when v_new_plan = 'growth' then 'plan.upgraded' else 'plan.downgraded' end,
        v_business_id, v_business_email, null, null,
        j_new->>'id',
        jsonb_build_object('from', v_old_plan, 'to', v_new_plan),
        null
      );
    end if;

  elsif tg_table_name = 'ad_ideas' and tg_op = 'UPDATE' then
    v_business_email := j_new->>'business_email';
    v_affiliate_email := j_new->>'affiliate_email';
    v_offer_id := nullif(j_new->>'offer_id', '')::uuid;
    select bp.id into v_business_id
      from public.business_profiles bp
      where lower(bp.business_email) = lower(v_business_email)
      limit 1;

    if (j_old->>'business_viewed_at') is null and (j_new->>'business_viewed_at') is not null then
      perform private.queue_affiliate_webhook_event(
        'proposal.viewed', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
        j_new->>'id',
        jsonb_build_object(
          'proposal_id', j_new->>'id',
          'offer_id', j_new->>'offer_id',
          'viewed_at', j_new->>'business_viewed_at'
        ),
        'proposal.viewed:' || (j_new->>'id')
      );
    end if;

    if (j_old->>'status') is distinct from (j_new->>'status') then
      if lower(coalesce(j_new->>'status','')) = 'approved' then
        perform private.queue_affiliate_webhook_event(
          'proposal.approved', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
          j_new->>'id',
          jsonb_build_object('proposal_id', j_new->>'id', 'offer_id', j_new->>'offer_id', 'note', null),
          null
        );
      elsif lower(coalesce(j_new->>'status','')) = 'rejected' then
        perform private.queue_affiliate_webhook_event(
          'proposal.rejected', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
          j_new->>'id',
          jsonb_build_object('proposal_id', j_new->>'id', 'offer_id', j_new->>'offer_id', 'reason', j_new->>'rejection_reason'),
          null
        );
      elsif lower(coalesce(j_new->>'status','')) = 'changes_requested' then
        perform private.queue_affiliate_webhook_event(
          'proposal.changes_requested', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
          j_new->>'id',
          jsonb_build_object('proposal_id', j_new->>'id', 'comment', j_new->>'rejection_reason'),
          null
        );
      end if;
    end if;

  elsif tg_table_name = 'live_ads' then
    v_business_email := case when tg_op = 'DELETE' then j_old->>'business_email' else j_new->>'business_email' end;
    v_affiliate_email := case when tg_op = 'DELETE' then j_old->>'affiliate_email' else j_new->>'affiliate_email' end;
    v_business_id := nullif(case when tg_op = 'DELETE' then j_old->>'business_id' else j_new->>'business_id' end, '')::uuid;
    v_offer_id := nullif(case when tg_op = 'DELETE' then j_old->>'offer_id' else j_new->>'offer_id' end, '')::uuid;

    if tg_op = 'INSERT' then
      perform private.queue_affiliate_webhook_event(
        'campaign.launched', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
        j_new->>'id',
        jsonb_build_object(
          'campaign_id', j_new->>'id',
          'proposal_id', j_new->>'ad_idea_id'
        ),
        'campaign.launched:live_ads:' || (j_new->>'id')
      );
    elsif tg_op = 'UPDATE'
      and lower(coalesce(j_old->>'status','')) <> 'paused'
      and lower(coalesce(j_new->>'status','')) = 'paused'
      and (j_new->>'terminated_by_business_at') is not null then
      perform private.queue_affiliate_webhook_event(
        'campaign.paused', v_business_id, v_business_email, v_offer_id, v_affiliate_email,
        j_new->>'id',
        jsonb_build_object(
          'campaign_id', j_new->>'id',
          'proposal_id', case when tg_table_name = 'live_ads' then j_new->>'ad_idea_id' else null end
        ),
        null
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.capture_affiliate_webhook_event()
  from public, anon, authenticated;

drop trigger if exists affiliate_webhook_business_profiles on public.business_profiles;
create trigger affiliate_webhook_business_profiles
after insert or update on public.business_profiles
for each row execute function private.capture_affiliate_webhook_event();

drop trigger if exists affiliate_webhook_offers on public.offers;
create trigger affiliate_webhook_offers
after insert or update on public.offers
for each row execute function private.capture_affiliate_webhook_event();

drop trigger if exists affiliate_webhook_meta_connections on public.meta_connections;
create trigger affiliate_webhook_meta_connections
after insert or update or delete on public.meta_connections
for each row execute function private.capture_affiliate_webhook_event();

drop trigger if exists affiliate_webhook_business_entitlements on public.business_entitlements;
create trigger affiliate_webhook_business_entitlements
after update on public.business_entitlements
for each row execute function private.capture_affiliate_webhook_event();

drop trigger if exists affiliate_webhook_ad_ideas on public.ad_ideas;
create trigger affiliate_webhook_ad_ideas
after update on public.ad_ideas
for each row execute function private.capture_affiliate_webhook_event();

drop trigger if exists affiliate_webhook_live_ads on public.live_ads;
create trigger affiliate_webhook_live_ads
after insert or update on public.live_ads
for each row execute function private.capture_affiliate_webhook_event();

create or replace function public.claim_affiliate_webhook_delivery(p_limit integer default 20)
returns setof public.affiliate_webhook_outbox
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with picked as (
    select o.id
    from public.affiliate_webhook_outbox o
    where o.status = 'pending'
      and o.next_attempt_at <= now()
      and (o.lease_until is null or o.lease_until < now())
    order by o.created_at asc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  )
  update public.affiliate_webhook_outbox o
  set status = 'sending',
      attempt_count = o.attempt_count + 1,
      last_attempt_at = now(),
      lease_token = gen_random_uuid(),
      lease_until = now() + interval '2 minutes',
      updated_at = now()
  from picked
  where o.id = picked.id
  returning o.*;
end;
$$;

revoke execute on function public.claim_affiliate_webhook_delivery(integer)
  from public, anon, authenticated;
grant execute on function public.claim_affiliate_webhook_delivery(integer) to service_role;

create or replace function private.enqueue_inactive_affiliate_webhook_events(p_inactive_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  with candidates as (
    select
      bp.id as business_id,
      lower(bp.business_email) as business_email,
      coalesce(u.last_sign_in_at, u.created_at, bp.created_at) as last_seen_at
    from public.business_profiles bp
    join auth.users u on u.id = bp.id
    where coalesce(u.last_sign_in_at, u.created_at, bp.created_at)
      <= now() - make_interval(days => greatest(1, coalesce(p_inactive_days, 7)))
  ),
  inserted as (
    insert into public.affiliate_webhook_outbox (
      event_type, business_id, business_email, entity_id, data, dedupe_key
    )
    select
      'brand.inactive',
      c.business_id,
      c.business_email,
      c.business_id::text,
      jsonb_build_object('last_seen_at', c.last_seen_at),
      'brand.inactive:' || c.business_id::text || ':' || extract(epoch from c.last_seen_at)::bigint::text
    from candidates c
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

revoke execute on function private.enqueue_inactive_affiliate_webhook_events(integer)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.enqueue_inactive_affiliate_webhook_events(integer) to service_role;

create or replace function public.enqueue_inactive_affiliate_webhook_events(p_inactive_days integer default 7)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.enqueue_inactive_affiliate_webhook_events(p_inactive_days);
$$;

revoke execute on function public.enqueue_inactive_affiliate_webhook_events(integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_inactive_affiliate_webhook_events(integer) to service_role;
