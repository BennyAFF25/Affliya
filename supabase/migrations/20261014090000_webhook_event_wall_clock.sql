-- New events use real enqueue time, not the start of a long transaction.
-- Existing history is untouched. Existing profile trigger compares business_name,
-- country and avatar_url with IS DISTINCT FROM and emits signup on INSERT.
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
    entity_id, data, dedupe_key, created_at
  )
  values (
    p_event_type, p_business_id, nullif(lower(trim(p_business_email)), ''),
    p_offer_id, nullif(lower(trim(p_affiliate_email)), ''),
    p_entity_id, coalesce(p_data, '{}'::jsonb), p_dedupe_key, clock_timestamp()
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


-- Replace only the business-profile capture trigger; other event capture stays intact.
-- Normalize null/empty/whitespace before treating a public profile field as edited.
create or replace function private.capture_brand_profile_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j_new jsonb := to_jsonb(new);
  j_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_changed jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.queue_affiliate_webhook_event(
      'brand.signed_up', new.id, new.business_email, null, null,
      new.id::text, jsonb_build_object('signup_source', null, 'category', null),
      'brand.signed_up:' || new.id::text
    );
    return new;
  end if;

  select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
  into v_changed
  from unnest(array['business_name','country','avatar_url']) as changed(key)
  where nullif(btrim(j_old->>key), '') is distinct from nullif(btrim(j_new->>key), '');

  -- Auth provisioning fills the business name in its nested signup trigger.
  -- This is initial setup, not a second user edit; signup already covers it.
  if pg_trigger_depth() > 1 and v_changed = '["business_name"]'::jsonb
     and nullif(btrim(j_old->>'business_name'), '') is null then
    return new;
  end if;

  if jsonb_array_length(v_changed) > 0 then
    perform private.queue_affiliate_webhook_event(
      'brand.profile_updated', new.id, new.business_email, null, null,
      new.id::text, jsonb_build_object('changed_fields', v_changed), null
    );
  end if;
  return new;
end;
$$;
revoke all on function private.capture_brand_profile_webhook_event() from public, anon, authenticated;
create or replace trigger affiliate_webhook_business_profiles
  after insert or update on public.business_profiles
  for each row execute function private.capture_brand_profile_webhook_event();
