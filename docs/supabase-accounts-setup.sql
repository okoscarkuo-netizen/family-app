-- Family App account cloud sync table.
-- Run this in Supabase SQL Editor, then add SUPABASE_SERVICE_ROLE_KEY to Vercel Production env.

create table if not exists public.family_accounts (
  id text primary key,
  name text not null,
  type text not null,
  owner text not null,
  kind text not null check (kind in ('asset', 'liability')),
  balance numeric(14, 2) not null default 0,
  currency text not null default 'TWD',
  hidden boolean not null default false,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_family_accounts_updated_at on public.family_accounts;
create trigger set_family_accounts_updated_at
before update on public.family_accounts
for each row execute function public.set_updated_at();

alter table public.family_accounts enable row level security;

-- No anon/authenticated policies are created on purpose.
-- The Next.js /api/accounts route writes through the server-only Supabase service role key
-- after verifying the private app access cookie.
