create table if not exists public.exchange_rate_snapshots (
  snapshot_date date primary key,
  source text not null default 'cbc',
  source_date date not null,
  rates jsonb not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exchange_rate_snapshots enable row level security;

drop trigger if exists set_exchange_rate_snapshots_updated_at on public.exchange_rate_snapshots;
create trigger set_exchange_rate_snapshots_updated_at
before update on public.exchange_rate_snapshots
for each row execute function public.set_updated_at();

comment on table public.exchange_rate_snapshots is
  'Cached CBC exchange-rate snapshots used to keep the dashboard independent from third-party live APIs.';
