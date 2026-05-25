create or replace function public.reimport_family_transactions_from_json(
  p_transactions jsonb
)
returns jsonb
language plpgsql
as $$
declare
  import_count integer;
  nonzero_count integer;
  zero_count integer;
  affected_account_count integer;
  has_opening_balance boolean;
begin
  SET LOCAL statement_timeout = '300000';

  if p_transactions is null or jsonb_typeof(p_transactions) <> 'array' then
    raise exception 'transactions payload must be a JSON array';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'family_accounts'
      and column_name = 'opening_balance'
  ) into has_opening_balance;

  create temporary table tmp_family_transaction_import (
    import_index integer primary key,
    id uuid not null,
    kind text not null,
    title text not null,
    amount numeric(14, 2) not null,
    currency text not null,
    category_id uuid,
    account_id text,
    to_account_id text,
    owner text not null,
    merchant text,
    merchant_id uuid,
    occurred_on date not null,
    occurred_at timestamptz,
    note text,
    created_at timestamptz
  ) on commit drop;

  insert into tmp_family_transaction_import (
    import_index,
    id,
    kind,
    title,
    amount,
    currency,
    category_id,
    account_id,
    to_account_id,
    owner,
    merchant,
    merchant_id,
    occurred_on,
    occurred_at,
    note,
    created_at
  )
  select
    input.ordinality::integer as import_index,
    coalesce(nullif(input.item->>'id', '')::uuid, gen_random_uuid()) as id,
    lower(coalesce(nullif(input.item->>'kind', ''), '')) as kind,
    coalesce(nullif(input.item->>'title', ''), nullif(input.item->>'category_name', ''), '未命名交易') as title,
    coalesce(nullif(input.item->>'amount', '')::numeric, 0) as amount,
    coalesce(nullif(input.item->>'currency', ''), 'TWD') as currency,
    nullif(input.item->>'category_id', '')::uuid as category_id,
    nullif(input.item->>'account_id', '') as account_id,
    nullif(input.item->>'to_account_id', '') as to_account_id,
    coalesce(nullif(input.item->>'owner', ''), 'Oscar') as owner,
    nullif(input.item->>'merchant', '') as merchant,
    nullif(input.item->>'merchant_id', '')::uuid as merchant_id,
    coalesce(nullif(input.item->>'occurred_on', '')::date, current_date) as occurred_on,
    nullif(input.item->>'occurred_at', '')::timestamptz as occurred_at,
    nullif(input.item->>'note', '') as note,
    nullif(input.item->>'created_at', '')::timestamptz as created_at
  from jsonb_array_elements(p_transactions) with ordinality as input(item, ordinality);

  select count(*) into import_count from tmp_family_transaction_import;
  select count(*) into zero_count from tmp_family_transaction_import where amount = 0;
  select count(*) into nonzero_count from tmp_family_transaction_import where amount <> 0;

  if exists (
    select 1 from tmp_family_transaction_import
    where kind not in ('income', 'expense', 'transfer')
  ) then
    raise exception 'Unsupported transaction kind in import payload';
  end if;

  if exists (
    select 1 from tmp_family_transaction_import where amount < 0
  ) then
    raise exception 'Imported transaction amount cannot be negative';
  end if;

  if exists (
    select 1 from tmp_family_transaction_import
    where title is null or btrim(title) = ''
  ) then
    raise exception 'Imported transaction title is required';
  end if;

  if exists (
    select 1 from tmp_family_transaction_import
    where amount <> 0 and kind in ('income', 'expense') and account_id is null
  ) then
    raise exception 'Imported income/expense transactions require account_id';
  end if;

  if exists (
    select 1 from tmp_family_transaction_import
    where amount <> 0
      and kind = 'transfer'
      and (account_id is null or to_account_id is null or account_id = to_account_id)
  ) then
    raise exception 'Imported transfer transactions require distinct account_id and to_account_id';
  end if;

  if exists (
    select 1 from tmp_family_transaction_import t
    left join public.family_accounts a on a.id = t.account_id
    where t.amount <> 0 and t.kind in ('income', 'expense') and a.id is null
  ) then
    raise exception 'Imported income/expense transactions reference missing account_id values';
  end if;

  if exists (
    select 1 from tmp_family_transaction_import t
    left join public.family_accounts a on a.id = t.account_id
    where t.amount <> 0 and t.kind = 'transfer' and a.id is null
  ) then
    raise exception 'Imported transfer source account_id values are missing';
  end if;

  if exists (
    select 1 from tmp_family_transaction_import t
    left join public.family_accounts a on a.id = t.to_account_id
    where t.amount <> 0 and t.kind = 'transfer' and a.id is null
  ) then
    raise exception 'Imported transfer destination to_account_id values are missing';
  end if;

  create temporary table tmp_family_transaction_delta (
    account_id text primary key,
    amount_delta numeric(14, 2) not null
  ) on commit drop;

  insert into tmp_family_transaction_delta (account_id, amount_delta)
  select
    delta_rows.account_id,
    round(sum(delta_rows.amount_delta), 2) as amount_delta
  from (
    select
      t.account_id,
      public.family_account_delta_for_transaction(t.kind, a.kind, t.amount, true) as amount_delta
    from tmp_family_transaction_import t
    join public.family_accounts a on a.id = t.account_id
    where t.amount <> 0 and t.kind in ('income', 'expense')

    union all

    select
      t.account_id,
      public.family_account_delta_for_transaction(t.kind, source_account.kind, t.amount, true) as amount_delta
    from tmp_family_transaction_import t
    join public.family_accounts source_account on source_account.id = t.account_id
    where t.amount <> 0 and t.kind = 'transfer'

    union all

    select
      t.to_account_id,
      public.family_account_delta_for_transaction(t.kind, destination_account.kind, t.amount, false) as amount_delta
    from tmp_family_transaction_import t
    join public.family_accounts destination_account on destination_account.id = t.to_account_id
    where t.amount <> 0 and t.kind = 'transfer'
  ) as delta_rows
  group by delta_rows.account_id;

  create temporary table tmp_family_account_snapshot (
    account_id text primary key,
    balance numeric(14, 2) not null
  ) on commit drop;

  if has_opening_balance then
    insert into tmp_family_account_snapshot (account_id, balance)
    select id, balance from public.family_accounts;

    execute $sql$
      update public.family_accounts account_row
      set
        balance = round(snapshot.balance - coalesce(delta.amount_delta, 0), 2),
        opening_balance = round(snapshot.balance - coalesce(delta.amount_delta, 0), 2)
      from tmp_family_account_snapshot snapshot
      left join tmp_family_transaction_delta delta on delta.account_id = snapshot.account_id
      where account_row.id = snapshot.account_id
    $sql$;
  else
    insert into tmp_family_account_snapshot (account_id, balance)
    select id, balance from public.family_accounts;

    update public.family_accounts account_row
    set balance = round(snapshot.balance - coalesce(delta.amount_delta, 0), 2)
    from tmp_family_account_snapshot snapshot
    left join tmp_family_transaction_delta delta on delta.account_id = snapshot.account_id
    where account_row.id = snapshot.account_id;
  end if;

  truncate table public.family_ledger_entries, public.family_transactions;

  insert into public.family_transactions (
    id, kind, title, amount, currency, category_id, account_id, to_account_id,
    owner, merchant, occurred_on, note, occurred_at, created_at, merchant_id
  )
  select
    id, kind, title, amount, currency, category_id, account_id, to_account_id,
    owner, merchant, occurred_on, note,
    coalesce(occurred_at, occurred_on::timestamp + interval '12 hours') as occurred_at,
    coalesce(created_at, coalesce(occurred_at, occurred_on::timestamp + interval '12 hours')) as created_at,
    merchant_id
  from tmp_family_transaction_import
  order by import_index;

  select count(*) into affected_account_count from tmp_family_transaction_delta;

  return jsonb_build_object(
    'transactions', import_count,
    'nonzero_transactions', nonzero_count,
    'zero_amount_transactions', zero_count,
    'affected_accounts', affected_account_count
  );
end;
$$;
