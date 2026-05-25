-- Allow zero-amount transactions (e.g. memo/note entries from AndroMoney)
alter table family_transactions
  drop constraint if exists family_transactions_amount_check,
  add constraint family_transactions_amount_check check (amount >= 0);
