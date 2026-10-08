-- Give every existing affiliate a public Nettmark username and protect
-- affiliate usernames from case-insensitive duplicates. Email remains an
-- internal authentication/delivery identifier.

with candidates as (
  select
    id,
    email,
    coalesce(
      nullif(
        regexp_replace(
          lower(split_part(coalesce(email, ''), '@', 1)),
          '[^a-z0-9._-]+',
          '',
          'g'
        ),
        ''
      ),
      'affiliate'
    ) as base_username
  from public.profiles
  where role = 'affiliate'
    and nullif(trim(username), '') is null
),
ranked as (
  select
    id,
    base_username,
    count(*) over (partition by base_username) as duplicate_count,
    row_number() over (partition by base_username order by id) as duplicate_rank
  from candidates
)
update public.profiles p
set username = case
  when r.duplicate_count = 1 then left(r.base_username, 24)
  else left(r.base_username, 19) || '_' || substr(replace(p.id::text, '-', ''), 1, 4)
end
from ranked r
where p.id = r.id;

create unique index if not exists profiles_affiliate_username_lower_unique
  on public.profiles (lower(username))
  where role = 'affiliate' and username is not null;

update public.affiliate_profiles ap
set display_name = p.username
from public.profiles p
where ap.user_id = p.id
  and p.role = 'affiliate'
  and nullif(trim(p.username), '') is not null
  and nullif(trim(ap.display_name), '') is null;
