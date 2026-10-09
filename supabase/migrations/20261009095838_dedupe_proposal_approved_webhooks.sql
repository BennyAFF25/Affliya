with first_approved as (
  select distinct on (entity_id) id, entity_id
  from public.affiliate_webhook_outbox
  where event_type = 'proposal.approved'
    and entity_id is not null
    and dedupe_key is null
  order by entity_id, created_at asc, id
)
update public.affiliate_webhook_outbox o
set dedupe_key = 'proposal.approved:' || f.entity_id,
    updated_at = now()
from first_approved f
where o.id = f.id;

create or replace function private.ensure_affiliate_webhook_dedupe()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'proposal.approved'
    and new.entity_id is not null
    and new.dedupe_key is null then
    new.dedupe_key := 'proposal.approved:' || new.entity_id;
  end if;
  return new;
end;
$$;

drop trigger if exists affiliate_webhook_outbox_dedupe on public.affiliate_webhook_outbox;
create trigger affiliate_webhook_outbox_dedupe
before insert on public.affiliate_webhook_outbox
for each row execute function private.ensure_affiliate_webhook_dedupe();
