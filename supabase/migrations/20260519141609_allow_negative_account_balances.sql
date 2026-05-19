alter table public.family_accounts
  drop constraint if exists family_accounts_balance_check;

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
