alter table public.business_entitlements
  add column if not exists billing_entry_mode text not null default 'plan_choice';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_entitlements_billing_entry_mode_check'
      and conrelid = 'public.business_entitlements'::regclass
  ) then
    alter table public.business_entitlements
      add constraint business_entitlements_billing_entry_mode_check
      check (billing_entry_mode in ('legacy_deferred', 'plan_choice'));
  end if;
end $$;

-- The plan-choice rollout began with commit 729a4c4 on 2026-09-15 07:16:27 UTC.
-- Businesses created before that point retain the legacy deferred-billing journey:
-- they enter My Business normally and are only asked to subscribe when paid
-- affiliate distribution is actually requested.
update public.business_entitlements be
set billing_entry_mode = 'legacy_deferred',
    updated_at = now()
from public.business_profiles bp
where bp.id = be.business_id
  and bp.created_at < timestamptz '2026-09-15 07:16:27+00';

update public.business_entitlements be
set billing_entry_mode = 'plan_choice',
    updated_at = now()
from public.business_profiles bp
where bp.id = be.business_id
  and bp.created_at >= timestamptz '2026-09-15 07:16:27+00';

create or replace function public.ensure_business_entitlement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.business_entitlements (
    business_id,
    business_email,
    billing_status,
    is_grandfathered,
    subscription_required,
    billing_entry_mode,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.business_email,
    'free',
    false,
    true,
    'plan_choice',
    now(),
    now()
  )
  on conflict (business_id) do update
    set business_email = excluded.business_email,
        updated_at = now();

  return new;
end;
$function$;
