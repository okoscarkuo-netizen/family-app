-- Recurring transactions templates
create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount numeric(18, 4) not null check (amount >= 0),
  currency text not null check (currency in ('TWD', 'USD', 'JPY')),
  account_id uuid not null references public.family_accounts(id) on delete cascade,
  target_account_id uuid references public.family_accounts(id) on delete cascade,
  target_amount numeric(18, 4),
  target_currency text check (target_currency in ('TWD', 'USD', 'JPY')),
  category_id uuid references public.family_categories(id) on delete set null,
  merchant_id uuid references public.family_merchants(id) on delete set null,
  owner text not null check (owner in ('Oscar', 'Livia')),
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date not null,
  next_due_date date not null,
  end_type text not null default 'forever' check (end_type in ('forever', 'count')),
  end_count integer,
  generated_count integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for cron lookup
create index if not exists recurring_transactions_active_due_idx
  on public.recurring_transactions (is_active, next_due_date)
  where is_active = true;

-- Link generated transactions back to template
alter table public.family_transactions
  add column if not exists recurring_id uuid references public.recurring_transactions(id) on delete set null;

-- Update timestamp trigger
create or replace function public.set_recurring_transactions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_recurring_transactions_updated_at on public.recurring_transactions;
create trigger set_recurring_transactions_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_recurring_transactions_updated_at();
