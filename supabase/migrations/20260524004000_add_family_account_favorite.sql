alter table public.family_accounts
  add column if not exists favorite boolean not null default false;

create index if not exists family_accounts_favorite_sort_idx
  on public.family_accounts (favorite desc, sort_order, created_at);
