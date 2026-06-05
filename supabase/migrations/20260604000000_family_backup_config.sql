-- Family App backup configuration (single row per household)
create table if not exists public.family_backup_config (
  household_id uuid primary key references public.households(id) on delete cascade,
  schedule text not null default 'biweekly' check (schedule in ('biweekly', 'monthly')),
  biweekly_anchor_date date not null default '2026-06-12',
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Auto-update timestamp
create or replace function public.set_family_backup_config_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists family_backup_config_updated_at on public.family_backup_config;
create trigger family_backup_config_updated_at
  before update on public.family_backup_config
  for each row execute function public.set_family_backup_config_updated_at();

-- Seed default row for every existing household
insert into public.family_backup_config (household_id)
select id from public.households
on conflict (household_id) do nothing;

-- RLS — only household members can read/write their config
alter table public.family_backup_config enable row level security;

drop policy if exists "household members can read backup config"
  on public.family_backup_config;
create policy "household members can read backup config"
  on public.family_backup_config for select
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

drop policy if exists "household members can upsert backup config"
  on public.family_backup_config;
create policy "household members can upsert backup config"
  on public.family_backup_config for all
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );
