-- Stage E: NettmarkShop themes + analytics

-- Global shop settings per affiliate
create table if not exists public.affiliate_shop_settings (
  affiliate_email text primary key,
  theme text not null default 'midnight',
  hero_image_url text,
  hero_blurb text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Traffic/click counters aggregated per day
create table if not exists public.shop_hits (
  affiliate_email text not null,
  event_date date not null default current_date,
  views integer not null default 0,
  clicks integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint shop_hits_pkey primary key (affiliate_email, event_date)
);

-- Helper function to increment view / click counts
create or replace function public.increment_shop_hit(
  p_affiliate_email text,
  p_kind text,
  p_event_date date default current_date
)
returns void
language plpgsql
as $$
declare
  v_kind text := lower(coalesce(p_kind, 'view'));
  v_date date := coalesce(p_event_date, current_date);
begin
  if p_affiliate_email is null then
    return;
  end if;

  insert into public.shop_hits (affiliate_email, event_date, views, clicks, updated_at)
  values (
    p_affiliate_email,
    v_date,
    case when v_kind = 'view' then 1 else 0 end,
    case when v_kind = 'click' then 1 else 0 end,
    now()
  )
  on conflict (affiliate_email, event_date)
  do update set
    views = public.shop_hits.views + case when v_kind = 'view' then 1 else 0 end,
    clicks = public.shop_hits.clicks + case when v_kind = 'click' then 1 else 0 end,
    updated_at = now();
end;
$$;
