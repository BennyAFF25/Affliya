-- Explicit snapshot of the linked Meta account's billing currency at proposal creation.
-- Preserve existing proposals; their currency is derived from the business offer until resubmitted.
alter table public.ad_ideas add column if not exists currency text;
alter table public.ad_ideas add constraint ad_ideas_currency_iso_check check (
  currency is null or currency ~ '^[A-Z]{3}$'
);
comment on column public.ad_ideas.currency is 'ISO 4217 currency snapshot validated against the selected Meta ad account at launch';
