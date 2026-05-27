alter table public.maintenance_reminders
  add column if not exists category text;
