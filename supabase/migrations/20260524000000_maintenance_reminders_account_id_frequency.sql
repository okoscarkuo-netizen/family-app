alter table public.maintenance_reminders
  add column if not exists account_id text references public.family_accounts(id) on delete set null,
  add column if not exists frequency reminder_frequency not null default 'quarterly';

create index if not exists maintenance_reminders_account_idx
  on public.maintenance_reminders (account_id);
