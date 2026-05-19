-- ─── family_ledger_entries ────────────────────────────────────────────
-- Signed account deltas generated from family_transactions.
-- Positive deltas increase the stored account balance; negative deltas reduce it.
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

alter table public.family_ledger_entries enable row level security;

comment on table public.family_ledger_entries is
  'Signed ledger entries generated from family_transactions and used to keep account balances in sync.';

-- Apply one signed delta to an account balance.
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
