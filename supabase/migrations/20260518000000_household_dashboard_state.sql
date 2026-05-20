create table if not exists public.household_dashboard_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.household_dashboard_state enable row level security;

drop trigger if exists set_household_dashboard_state_updated_at on public.household_dashboard_state;
create trigger set_household_dashboard_state_updated_at
before update on public.household_dashboard_state
for each row execute function public.set_updated_at();

create policy "members can manage dashboard state"
  on public.household_dashboard_state for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = household_dashboard_state.household_id
        and household_members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.household_members
      where household_members.household_id = household_dashboard_state.household_id
        and household_members.user_id = auth.uid()
    )
  );
