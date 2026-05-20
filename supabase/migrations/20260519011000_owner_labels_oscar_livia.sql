alter table public.family_transactions
  drop constraint if exists family_transactions_owner_check;

update public.family_accounts
set owner = case
  when owner in ('共同', '共用', '我', 'Oscar') then 'Oscar'
  when owner in ('老婆', 'Livia') then 'Livia'
  else owner
end;

update public.family_transactions
set owner = case
  when owner in ('共同', '共用', '我', 'Oscar') then 'Oscar'
  when owner in ('老婆', 'Livia') then 'Livia'
  else owner
end;

alter table public.family_transactions
  add constraint family_transactions_owner_check
  check (owner in ('Oscar', 'Livia'));
