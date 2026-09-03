alter table if exists public.marketing_site_events
  drop constraint if exists marketing_site_events_event_type_check;

alter table if exists public.marketing_site_events
  add constraint marketing_site_events_event_type_check
  check (event_type in ('page_view', 'create_account_start', 'business_demo_cta_click', 'account_created'));
