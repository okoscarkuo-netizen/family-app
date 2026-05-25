alter table public.family_transactions
  add column if not exists transfer_target_amount numeric(12, 2),
  add column if not exists transfer_target_currency text;

update public.family_transactions
set
  transfer_target_amount = coalesce(transfer_target_amount, amount),
  transfer_target_currency = coalesce(transfer_target_currency, currency)
where kind = 'transfer';

create or replace function public.create_family_ledger_entries_for_transaction()
returns trigger
language plpgsql
as $$
declare
  source_kind text;
  target_kind text;
  source_delta numeric(14, 2);
  target_delta numeric(14, 2);
  target_amount numeric(12, 2);
  target_currency text;
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

    target_amount := coalesce(new.transfer_target_amount, new.amount);
    target_currency := coalesce(new.transfer_target_currency, new.currency);

    source_delta := public.family_account_delta_for_transaction(
      new.kind,
      source_kind,
      new.amount,
      true
    );
    target_delta := public.family_account_delta_for_transaction(
      new.kind,
      target_kind,
      target_amount,
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
      (new.id, new.to_account_id, target_delta, target_currency, 'destination');

    perform public.apply_family_account_delta(new.account_id, source_delta);
    perform public.apply_family_account_delta(new.to_account_id, target_delta);
    return new;
  end if;

  raise exception 'Unsupported transaction kind: %', new.kind;
end;
$$;
