update public.affiliate_webhook_outbox o
set dedupe_key = null,
    status = 'skipped',
    delivered_at = coalesce(delivered_at, now()),
    last_error = 'Historical premature proposal approval emitted before a successful live campaign launch.',
    updated_at = now()
where o.event_type = 'proposal.approved'
  and o.entity_id is not null
  and not exists (
    select 1
    from public.live_ads la
    where la.ad_idea_id::text = o.entity_id
  );

create or replace function private.ensure_affiliate_webhook_dedupe()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'proposal.approved' then
    if new.entity_id is null or not exists (
      select 1
      from public.live_ads la
      where la.ad_idea_id::text = new.entity_id
    ) then
      return null;
    end if;

    if new.dedupe_key is null then
      new.dedupe_key := 'proposal.approved:' || new.entity_id;
    end if;
  end if;

  return new;
end;
$$;
