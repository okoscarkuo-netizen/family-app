alter table public.family_accounts
  add column if not exists opening_balance numeric(14, 2) not null default 0;

update public.family_accounts
set opening_balance = balance
where opening_balance = 0
  and balance <> 0;
