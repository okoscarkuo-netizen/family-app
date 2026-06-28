alter table public.maintenance_reminders
  add column if not exists is_paused boolean not null default false;

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  reminder_id uuid not null references public.maintenance_reminders(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  completed_on date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_records_reminder_completed_idx
  on public.maintenance_records (reminder_id, completed_on desc, created_at desc);

create index if not exists maintenance_records_household_completed_idx
  on public.maintenance_records (household_id, completed_on desc, created_at desc);

alter table public.maintenance_records enable row level security;

create policy "members can manage maintenance records"
  on public.maintenance_records for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = maintenance_records.household_id
        and household_members.user_id = auth.uid()
    )
  )
  with check (created_by = auth.uid());
