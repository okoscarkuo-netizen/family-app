create or replace function public.reverse_family_transaction_account_effect(
  p_transaction_kind text,
  p_amount numeric,
  p_account_id text,
  p_to_account_id text
)
returns void
language plpgsql
as $$
declare
  source_kind text;
  target_kind text;
  source_delta numeric(14, 2);
  target_delta numeric(14, 2);
begin
  if p_transaction_kind in ('income', 'expense') then
    if p_account_id is null then
      raise exception 'account_id is required for % transactions', p_transaction_kind
        using errcode = '23502';
    end if;

    select kind into source_kind
    from public.family_accounts
    where id = p_account_id;

    if source_kind is null then
      raise exception 'Account % not found', p_account_id
        using errcode = '23503';
    end if;

    source_delta := public.family_account_delta_for_transaction(
      p_transaction_kind,
      source_kind,
      p_amount,
      true
    );

    perform public.apply_family_account_delta(p_account_id, -source_delta);
    return;
  end if;

  if p_transaction_kind = 'transfer' then
    if p_account_id is null or p_to_account_id is null then
      raise exception 'account_id and to_account_id are required for transfer transactions'
        using errcode = '23502';
    end if;

    select kind into source_kind
    from public.family_accounts
    where id = p_account_id;

    select kind into target_kind
    from public.family_accounts
    where id = p_to_account_id;

    if source_kind is null or target_kind is null then
      raise exception 'Transfer account not found'
        using errcode = '23503';
    end if;

    source_delta := public.family_account_delta_for_transaction(
      p_transaction_kind,
      source_kind,
      p_amount,
      true
    );
    target_delta := public.family_account_delta_for_transaction(
      p_transaction_kind,
      target_kind,
      p_amount,
      false
    );

    perform public.apply_family_account_delta(p_account_id, -source_delta);
    perform public.apply_family_account_delta(p_to_account_id, -target_delta);
    return;
  end if;

  raise exception 'Unsupported transaction kind: %', p_transaction_kind;
end;
$$;

create or replace function public.reverse_family_ledger_entries_for_transaction()
returns trigger
language plpgsql
as $$
declare
  entry record;
  reversed_entries integer := 0;
begin
  for entry in
    select account_id, amount_delta
    from public.family_ledger_entries
    where transaction_id = old.id
  loop
    perform public.apply_family_account_delta(entry.account_id, -entry.amount_delta);
    reversed_entries := reversed_entries + 1;
  end loop;

  if reversed_entries = 0 then
    perform public.reverse_family_transaction_account_effect(
      old.kind,
      old.amount,
      old.account_id,
      old.to_account_id
    );
  end if;

  return old;
end;
$$;

create or replace function public.refresh_family_ledger_entries_before_transaction_update()
returns trigger
language plpgsql
as $$
declare
  entry record;
  reversed_entries integer := 0;
begin
  for entry in
    select account_id, amount_delta
    from public.family_ledger_entries
    where transaction_id = old.id
  loop
    perform public.apply_family_account_delta(entry.account_id, -entry.amount_delta);
    reversed_entries := reversed_entries + 1;
  end loop;

  if reversed_entries = 0 then
    perform public.reverse_family_transaction_account_effect(
      old.kind,
      old.amount,
      old.account_id,
      old.to_account_id
    );
  end if;

  delete from public.family_ledger_entries
  where transaction_id = old.id;

  return new;
end;
$$;

drop trigger if exists refresh_family_ledger_entries_before_update on public.family_transactions;
create trigger refresh_family_ledger_entries_before_update
before update on public.family_transactions
for each row execute function public.refresh_family_ledger_entries_before_transaction_update();

drop trigger if exists create_family_ledger_entries_after_update on public.family_transactions;
create trigger create_family_ledger_entries_after_update
after update on public.family_transactions
for each row execute function public.create_family_ledger_entries_for_transaction();
