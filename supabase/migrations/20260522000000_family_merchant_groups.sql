create table if not exists public.family_merchant_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists family_merchant_groups_name_unique
  on public.family_merchant_groups (lower(name));

create index if not exists family_merchant_groups_sort_idx
  on public.family_merchant_groups (sort_order, name);

alter table public.family_merchant_groups enable row level security;

drop trigger if exists set_family_merchant_groups_updated_at on public.family_merchant_groups;
create trigger set_family_merchant_groups_updated_at
before update on public.family_merchant_groups
for each row execute function public.set_updated_at();

alter table public.family_merchants
  add column if not exists group_id uuid references public.family_merchant_groups(id) on delete set null;

create index if not exists family_merchants_group_idx
  on public.family_merchants (group_id);

insert into public.family_merchant_groups (name, sort_order, is_archived)
select '台灣', 1, false
where not exists (
  select 1
  from public.family_merchant_groups
  where lower(name) = lower('台灣')
);

insert into public.family_merchant_groups (name, sort_order, is_archived)
select '美國', 2, false
where not exists (
  select 1
  from public.family_merchant_groups
  where lower(name) = lower('美國')
);

with group_ids as (
  select id as taiwan_id
  from public.family_merchant_groups
  where lower(name) = lower('台灣')
  limit 1
)
update public.family_merchants merchant
set group_id = group_ids.taiwan_id
from group_ids
where merchant.group_id is distinct from group_ids.taiwan_id;
