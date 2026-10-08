-- Allow exact cents for estimated affiliate commission values.
-- Also normalize the legacy tracking host label to the canonical UI value.

alter table public.offers
  alter column commission_value type numeric(12,2)
  using commission_value::numeric(12,2);

update public.offers
set site_host = 'Custom/Other'
where site_host = 'Custom site';
