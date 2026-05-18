-- TICKET-016H: Affiliate shop access request flow

create table if not exists public.affiliate_shop_requests (
  id uuid primary key default gen_random_uuid(),
  affiliate_email text not null,
  business_email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_affiliate_shop_requests_affiliate_email
  on public.affiliate_shop_requests (affiliate_email);

create index if not exists idx_affiliate_shop_requests_business_email
  on public.affiliate_shop_requests (business_email);

create index if not exists idx_affiliate_shop_requests_status
  on public.affiliate_shop_requests (status);

alter table public.affiliate_shop_requests enable row level security;

create policy "shop_requests_select_own"
on public.affiliate_shop_requests
for select
using (
  auth.email() = affiliate_email
  or auth.email() = business_email
);

create policy "shop_requests_insert_affiliate"
on public.affiliate_shop_requests
for insert
with check (
  auth.email() = affiliate_email
);

create policy "shop_requests_update_business"
on public.affiliate_shop_requests
for update
using (
  auth.email() = business_email
)
with check (
  auth.email() = business_email
);
