create table if not exists public.affiliate_shop_items (
  id uuid primary key default gen_random_uuid(),
  affiliate_email text not null,
  offer_id uuid not null references public.offers(id) on delete cascade,
  custom_image_url text,
  custom_price text,
  custom_description text,
  display_order int default 0,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_shop_items_affiliate_email_idx
  on public.affiliate_shop_items(affiliate_email);

create unique index if not exists affiliate_shop_unique_offer
  on public.affiliate_shop_items(affiliate_email, offer_id);
