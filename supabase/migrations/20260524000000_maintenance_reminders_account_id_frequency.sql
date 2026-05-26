do $$
begin
  create type public.reminder_frequency as enum ('once', 'weekly', 'monthly', 'quarterly', 'yearly');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  detail text,
  due_on date,
  mileage_due integer,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.maintenance_reminders
  add column if not exists account_id text references public.family_accounts(id) on delete set null,
  add column if not exists frequency reminder_frequency not null default 'quarterly';

create index if not exists maintenance_reminders_account_idx
  on public.maintenance_reminders (account_id);
