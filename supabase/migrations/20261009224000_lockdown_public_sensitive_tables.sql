-- Restrict previously unrestricted exposed tables without changing service-role operations.
-- Public financial/Meta secrets remain service-only; public storefront descriptions remain readable.
-- All ownership checks use Supabase Auth-issued JWT email (not user_metadata).
do $$
declare table_name text;
begin
  foreach table_name in array array['meta_connections','wallets','wallet_deductions','wallet_refunds','profiles','live_campaigns','processed_conversions','pre_signup_revenue','meta_pixels','affiliate_shop_settings','shop_hits','affiliate_shop_items','billable_event_quarantine','money_flow_audit_log','ad_spend_settlements','platform_fee_ledger'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', table_name);
  end loop;
end $$;

-- Token column must never be readable through browser Supabase clients.
grant select (
  id, business_email, meta_user_email, meta_user_name, ad_account_id,
  page_id, created_at, page_name, ad_account_name, ad_account_currency,
  pixel_id, pixel_name, pixel_verified
) on public.meta_connections to authenticated;
create policy meta_connections_owner_select on public.meta_connections
for select to authenticated
using (lower(business_email) = lower((select auth.jwt()->>'email')));

-- Wallets and ledger movements are read-only for their owner, never client-writable.
grant select on public.wallets, public.wallet_deductions, public.wallet_refunds to authenticated;
create policy wallets_owner_read on public.wallets for select to authenticated
using (lower(email) = lower((select auth.jwt()->>'email')));
create policy wallet_deductions_owner_read on public.wallet_deductions for select to authenticated
using (lower(affiliate_email) = lower((select auth.jwt()->>'email')));
create policy wallet_refunds_owner_read on public.wallet_refunds for select to authenticated
using (lower(affiliate_email) = lower((select auth.jwt()->>'email')));

-- Profile rows contain Stripe/customer data. Never expose affiliates' other rows
-- via Data API; business proposal username lookups now use an authorised server route.
grant select, insert on public.profiles to authenticated;
grant update (username, onboarding_completed, terms_accepted, terms_accepted_at, payout_threshold_cents)
on public.profiles to authenticated;
create policy profiles_owner_read on public.profiles for select to authenticated
using (lower(email) = lower((select auth.jwt()->>'email')));
create policy profiles_owner_insert on public.profiles for insert to authenticated
with check (
  id = (select auth.uid())
  and lower(email) = lower((select auth.jwt()->>'email'))
);
create policy profiles_owner_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and lower(email) = lower((select auth.jwt()->>'email')))
with check (id = (select auth.uid()) and lower(email) = lower((select auth.jwt()->>'email')));

-- Organic campaign rows may be read only by either participating account.
-- Creation/state transitions remain service-only.
grant select on public.live_campaigns to authenticated;
create policy live_campaigns_participant_read on public.live_campaigns
for select to authenticated
using (
 lower(coalesce(business_email,'')) = lower((select auth.jwt()->>'email'))
 or lower(coalesce(affiliate_email,'')) = lower((select auth.jwt()->>'email'))
);

-- Public storefront content remains discoverable; only the affiliate can edit it.
grant select on public.affiliate_shop_settings, public.affiliate_shop_items to anon, authenticated;
grant insert, update, delete on public.affiliate_shop_settings, public.affiliate_shop_items to authenticated;
create policy shop_settings_public_read on public.affiliate_shop_settings
for select to anon, authenticated using (true);
create policy shop_settings_owner_insert on public.affiliate_shop_settings
for insert to authenticated with check (lower(affiliate_email) = lower((select auth.jwt()->>'email')));
create policy shop_settings_owner_update on public.affiliate_shop_settings
for update to authenticated using (lower(affiliate_email) = lower((select auth.jwt()->>'email')))
with check (lower(affiliate_email) = lower((select auth.jwt()->>'email')));
create policy shop_settings_owner_delete on public.affiliate_shop_settings
for delete to authenticated using (lower(affiliate_email) = lower((select auth.jwt()->>'email')));
create policy shop_items_public_read on public.affiliate_shop_items
for select to anon, authenticated using (true);
create policy shop_items_owner_insert on public.affiliate_shop_items
for insert to authenticated with check (lower(affiliate_email) = lower((select auth.jwt()->>'email')));
create policy shop_items_owner_update on public.affiliate_shop_items
for update to authenticated using (lower(affiliate_email) = lower((select auth.jwt()->>'email')))
with check (lower(affiliate_email) = lower((select auth.jwt()->>'email')));
create policy shop_items_owner_delete on public.affiliate_shop_items
for delete to authenticated using (lower(affiliate_email) = lower((select auth.jwt()->>'email')));

-- Traffic counts are private; writes and all finance/Meta ledger updates are server-only.
grant select on public.shop_hits to authenticated;
create policy shop_hits_owner_read on public.shop_hits
for select to authenticated
using (lower(affiliate_email) = lower((select auth.jwt()->>'email')));

-- Intentionally no client policies or grants on:
-- processed_conversions, pre_signup_revenue, meta_pixels, billable_event_quarantine,
-- money_flow_audit_log, ad_spend_settlements, platform_fee_ledger.
