alter table public.family_transactions
  add column if not exists occurred_at timestamptz;

update public.family_transactions
set occurred_at = coalesce(
  occurred_at,
  occurred_on::timestamp at time zone 'UTC',
  created_at
);

alter table public.family_transactions
  alter column occurred_at set default now();

alter table public.family_transactions
  alter column occurred_at set not null;

create index if not exists family_transactions_occurred_at_idx
  on public.family_transactions (occurred_at desc);
