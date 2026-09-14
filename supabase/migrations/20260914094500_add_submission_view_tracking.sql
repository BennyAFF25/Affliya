alter table public.ad_ideas
  add column if not exists business_viewed_at timestamptz;

alter table public.organic_posts
  add column if not exists business_viewed_at timestamptz;

create index if not exists ad_ideas_affiliate_email_created_at_idx
  on public.ad_ideas (affiliate_email, created_at desc);

create index if not exists organic_posts_affiliate_email_created_at_idx
  on public.organic_posts (affiliate_email, created_at desc);
