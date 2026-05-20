create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'household_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.household_role as enum ('owner', 'member');
  end if;
end
$$;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_role not null default 'member',
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx
  on public.household_members (user_id, created_at);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists "members can read households" on public.households;
create policy "members can read households"
  on public.households for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = households.id
        and household_members.user_id = auth.uid()
    )
  );

drop policy if exists "users can create households" on public.households;
create policy "users can create households"
  on public.households for insert
  with check (created_by = auth.uid());

drop policy if exists "members can read membership" on public.household_members;
create policy "members can read membership"
  on public.household_members for select
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "household owners can manage membership" on public.household_members;
create policy "household owners can manage membership"
  on public.household_members for all
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );
