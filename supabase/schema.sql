create extension if not exists "pgcrypto";

create type household_role as enum ('owner', 'member');
create type transaction_kind as enum ('income', 'expense');
create type reminder_frequency as enum ('once', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role household_role not null default 'member',
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  kind transaction_kind not null,
  category text not null,
  title text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bill_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12, 2),
  due_on date not null,
  frequency reminder_frequency not null default 'monthly',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  detail text,
  due_on date,
  mileage_due integer,
  completed_at timestamptz,
  is_paused boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  reminder_id uuid not null references public.maintenance_reminders(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  completed_on date not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.household_dashboard_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exchange_rate_snapshots (
  snapshot_date date primary key,
  source text not null default 'cbc',
  source_date date not null,
  rates jsonb not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_accounts (
  id text primary key,
  name text not null,
  type text not null,
  owner text not null,
  shared boolean not null default false,
  favorite boolean not null default false,
  kind text not null check (kind in ('asset', 'liability')),
  balance numeric(14, 2) not null default 0,
  opening_balance numeric(14, 2) not null default 0,
  remark text,
  currency text not null default 'TWD',
  hidden boolean not null default false,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_accounts_active_sort_idx
  on public.family_accounts (is_archived, sort_order, created_at);

create index if not exists family_accounts_favorite_sort_idx
  on public.family_accounts (favorite desc, sort_order, created_at);

comment on table public.family_accounts is
  'Single-family passcode-gated account list. Access is intentionally server-side through a Supabase service role key.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_family_accounts_updated_at on public.family_accounts;
create trigger set_family_accounts_updated_at
before update on public.family_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_exchange_rate_snapshots_updated_at on public.exchange_rate_snapshots;
create trigger set_exchange_rate_snapshots_updated_at
before update on public.exchange_rate_snapshots
for each row execute function public.set_updated_at();

alter table public.maintenance_reminders
  add column if not exists account_id text references public.family_accounts(id) on delete set null,
  add column if not exists frequency reminder_frequency not null default 'quarterly',
  add column if not exists is_paused boolean not null default false;

create index if not exists maintenance_reminders_account_idx
  on public.maintenance_reminders (account_id);

create index if not exists maintenance_records_reminder_completed_idx
  on public.maintenance_records (reminder_id, completed_on desc, created_at desc);

create index if not exists maintenance_records_household_completed_idx
  on public.maintenance_records (household_id, completed_on desc, created_at desc);

create table if not exists public.family_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.family_transactions(id) on delete cascade,
  account_id text not null references public.family_accounts(id) on delete restrict,
  amount_delta numeric(14, 2) not null check (amount_delta <> 0),
  currency text not null default 'TWD',
  entry_role text not null check (entry_role in ('single', 'source', 'destination')),
  created_at timestamptz not null default now()
);

create index if not exists family_ledger_entries_transaction_idx
  on public.family_ledger_entries (transaction_id);

create index if not exists family_ledger_entries_account_idx
  on public.family_ledger_entries (account_id, created_at desc);

comment on table public.family_ledger_entries is
  'Signed ledger entries generated from family_transactions and used to keep account balances in sync.';

create or replace function public.apply_family_account_delta(
  p_account_id text,
  p_amount_delta numeric
)
returns void
language plpgsql
as $$
begin
  update public.family_accounts
  set balance = round(balance + p_amount_delta, 2)
  where id = p_account_id;

  if not found then
    raise exception 'Account % not found', p_account_id
      using errcode = '23503';
  end if;
end;
$$;

create or replace function public.family_account_delta_for_transaction(
  p_transaction_kind text,
  p_account_kind text,
  p_amount numeric,
  p_is_source boolean
)
returns numeric
language plpgsql
as $$
begin
  if p_transaction_kind = 'expense' then
    if p_account_kind = 'liability' then
      return p_amount;
    end if;
    return -p_amount;
  end if;

  if p_transaction_kind = 'income' then
    if p_account_kind = 'liability' then
      return -p_amount;
    end if;
    return p_amount;
  end if;

  if p_transaction_kind = 'transfer' then
    if p_is_source then
      if p_account_kind = 'liability' then
        return p_amount;
      end if;
      return -p_amount;
    end if;

    if p_account_kind = 'liability' then
      return -p_amount;
    end if;
    return p_amount;
  end if;

  raise exception 'Unsupported transaction kind: %', p_transaction_kind;
end;
$$;

create or replace function public.create_family_ledger_entries_for_transaction()
returns trigger
language plpgsql
as $$
declare
  source_kind text;
  target_kind text;
  source_delta numeric(14, 2);
  target_delta numeric(14, 2);
begin
  if new.kind in ('income', 'expense') then
    if new.account_id is null then
      raise exception 'account_id is required for % transactions', new.kind
        using errcode = '23502';
    end if;

    select kind into source_kind
    from public.family_accounts
    where id = new.account_id;

    if source_kind is null then
      raise exception 'Account % not found', new.account_id
        using errcode = '23503';
    end if;

    source_delta := public.family_account_delta_for_transaction(
      new.kind,
      source_kind,
      new.amount,
      true
    );

    insert into public.family_ledger_entries (
      transaction_id,
      account_id,
      amount_delta,
      currency,
      entry_role
    ) values (
      new.id,
      new.account_id,
      source_delta,
      new.currency,
      'single'
    );

    perform public.apply_family_account_delta(new.account_id, source_delta);
    return new;
  end if;

  if new.kind = 'transfer' then
    if new.account_id is null or new.to_account_id is null then
      raise exception 'account_id and to_account_id are required for transfer transactions'
        using errcode = '23502';
    end if;

    if new.account_id = new.to_account_id then
      raise exception 'Transfer source and destination accounts must be different'
        using errcode = '23514';
    end if;

    select kind into source_kind
    from public.family_accounts
    where id = new.account_id;

    select kind into target_kind
    from public.family_accounts
    where id = new.to_account_id;

    if source_kind is null or target_kind is null then
      raise exception 'Transfer account not found'
        using errcode = '23503';
    end if;

    source_delta := public.family_account_delta_for_transaction(
      new.kind,
      source_kind,
      new.amount,
      true
    );
    target_delta := public.family_account_delta_for_transaction(
      new.kind,
      target_kind,
      new.amount,
      false
    );

    insert into public.family_ledger_entries (
      transaction_id,
      account_id,
      amount_delta,
      currency,
      entry_role
    ) values
      (new.id, new.account_id, source_delta, new.currency, 'source'),
      (new.id, new.to_account_id, target_delta, new.currency, 'destination');

    perform public.apply_family_account_delta(new.account_id, source_delta);
    perform public.apply_family_account_delta(new.to_account_id, target_delta);
    return new;
  end if;

  raise exception 'Unsupported transaction kind: %', new.kind;
end;
$$;

create or replace function public.reverse_family_ledger_entries_for_transaction()
returns trigger
language plpgsql
as $$
declare
  entry record;
begin
  for entry in
    select account_id, amount_delta
    from public.family_ledger_entries
    where transaction_id = old.id
  loop
    perform public.apply_family_account_delta(entry.account_id, -entry.amount_delta);
  end loop;

  return old;
end;
$$;

drop trigger if exists create_family_ledger_entries_after_insert on public.family_transactions;
create trigger create_family_ledger_entries_after_insert
after insert on public.family_transactions
for each row execute function public.create_family_ledger_entries_for_transaction();

drop trigger if exists reverse_family_ledger_entries_before_delete on public.family_transactions;
create trigger reverse_family_ledger_entries_before_delete
before delete on public.family_transactions
for each row execute function public.reverse_family_ledger_entries_for_transaction();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.todos enable row level security;
alter table public.bill_reminders enable row level security;
alter table public.maintenance_reminders enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.household_dashboard_state enable row level security;
alter table public.exchange_rate_snapshots enable row level security;
alter table public.family_accounts enable row level security;
alter table public.family_ledger_entries enable row level security;

create policy "members can read households"
  on public.households for select
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = households.id
        and household_members.user_id = auth.uid()
    )
  );

create policy "users can create households"
  on public.households for insert
  with check (created_by = auth.uid());

create policy "members can read membership"
  on public.household_members for select
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
    )
  );

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

create policy "members can manage transactions"
  on public.transactions for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = transactions.household_id
        and household_members.user_id = auth.uid()
    )
  )
  with check (created_by = auth.uid());

create policy "members can manage todos"
  on public.todos for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = todos.household_id
        and household_members.user_id = auth.uid()
    )
  )
  with check (created_by = auth.uid());

create policy "members can manage bill reminders"
  on public.bill_reminders for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = bill_reminders.household_id
        and household_members.user_id = auth.uid()
    )
  )
  with check (created_by = auth.uid());

create policy "members can manage maintenance reminders"
  on public.maintenance_reminders for all
  using (
    exists (
      select 1 from public.household_members
      where household_members.household_id = maintenance_reminders.household_id
        and household_members.user_id = auth.uid()
    )
  )
  with check (created_by = auth.uid());

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
