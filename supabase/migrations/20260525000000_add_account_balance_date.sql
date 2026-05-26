-- Add balance_date to family_accounts: records the date when balance was last confirmed
alter table public.family_accounts
  add column if not exists balance_date date;

-- Add balance_skipped to family_ledger_entries:
-- true = this transaction predates the account's balance_date, so it was NOT applied to the stored balance
alter table public.family_ledger_entries
  add column if not exists balance_skipped boolean not null default false;

-- Rewrite create trigger to skip balance update for pre-date transactions
create or replace function public.create_family_ledger_entries_for_transaction()
returns trigger
language plpgsql
as $$
declare
  source_kind text;
  target_kind text;
  source_delta numeric(14, 2);
  target_delta numeric(14, 2);
  source_balance_date date;
  target_balance_date date;
  source_skipped boolean;
  target_skipped boolean;
begin
  if new.amount = 0 then
    return new;
  end if;

  if new.kind in ('income', 'expense') then
    if new.account_id is null then
      raise exception 'account_id is required for % transactions', new.kind
        using errcode = '23502';
    end if;

    select kind, balance_date into source_kind, source_balance_date
    from public.family_accounts
    where id = new.account_id;

    if source_kind is null then
      raise exception 'Account % not found', new.account_id
        using errcode = '23503';
    end if;

    source_delta := public.family_account_delta_for_transaction(
      new.kind, source_kind, new.amount, true
    );

    source_skipped := source_balance_date is not null and new.occurred_on <= source_balance_date;

    insert into public.family_ledger_entries (
      transaction_id, account_id, amount_delta, currency, entry_role, balance_skipped
    ) values (
      new.id, new.account_id, source_delta, new.currency, 'single', source_skipped
    );

    if not source_skipped then
      perform public.apply_family_account_delta(new.account_id, source_delta);
    end if;

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

    select kind, balance_date into source_kind, source_balance_date
    from public.family_accounts
    where id = new.account_id;

    select kind, balance_date into target_kind, target_balance_date
    from public.family_accounts
    where id = new.to_account_id;

    if source_kind is null or target_kind is null then
      raise exception 'Transfer account not found'
        using errcode = '23503';
    end if;

    source_delta := public.family_account_delta_for_transaction(
      new.kind, source_kind, new.amount, true
    );
    target_delta := public.family_account_delta_for_transaction(
      new.kind, target_kind, new.amount, false
    );

    source_skipped := source_balance_date is not null and new.occurred_on <= source_balance_date;
    target_skipped := target_balance_date is not null and new.occurred_on <= target_balance_date;

    insert into public.family_ledger_entries (
      transaction_id, account_id, amount_delta, currency, entry_role, balance_skipped
    ) values
      (new.id, new.account_id, source_delta, new.currency, 'source', source_skipped),
      (new.id, new.to_account_id, target_delta, new.currency, 'destination', target_skipped);

    if not source_skipped then
      perform public.apply_family_account_delta(new.account_id, source_delta);
    end if;
    if not target_skipped then
      perform public.apply_family_account_delta(new.to_account_id, target_delta);
    end if;

    return new;
  end if;

  raise exception 'Unsupported transaction kind: %', new.kind;
end;
$$;

-- Rewrite reverse trigger to skip balance reversal for balance_skipped entries
create or replace function public.reverse_family_ledger_entries_for_transaction()
returns trigger
language plpgsql
as $$
declare
  entry record;
  reversed_entries integer := 0;
begin
  for entry in
    select account_id, amount_delta, balance_skipped
    from public.family_ledger_entries
    where transaction_id = old.id
  loop
    if not entry.balance_skipped then
      perform public.apply_family_account_delta(entry.account_id, -entry.amount_delta);
    end if;
    reversed_entries := reversed_entries + 1;
  end loop;

  if reversed_entries = 0 then
    perform public.reverse_family_transaction_account_effect(
      old.kind, old.amount, old.account_id, old.to_account_id
    );
  end if;

  return old;
end;
$$;

-- Rewrite update-before trigger to respect balance_skipped
create or replace function public.refresh_family_ledger_entries_before_transaction_update()
returns trigger
language plpgsql
as $$
declare
  entry record;
  reversed_entries integer := 0;
begin
  for entry in
    select account_id, amount_delta, balance_skipped
    from public.family_ledger_entries
    where transaction_id = old.id
  loop
    if not entry.balance_skipped then
      perform public.apply_family_account_delta(entry.account_id, -entry.amount_delta);
    end if;
    reversed_entries := reversed_entries + 1;
  end loop;

  if reversed_entries = 0 then
    perform public.reverse_family_transaction_account_effect(
      old.kind, old.amount, old.account_id, old.to_account_id
    );
  end if;

  delete from public.family_ledger_entries
  where transaction_id = old.id;

  return new;
end;
$$;
