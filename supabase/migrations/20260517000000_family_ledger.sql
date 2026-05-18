-- ─── family_categories ───────────────────────────────────────────────
create table if not exists public.family_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  icon text,
  color text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  source_app text,
  created_at timestamptz not null default now()
);

alter table public.family_categories enable row level security;

-- ─── family_transactions ─────────────────────────────────────────────
create table if not exists public.family_transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'TWD',
  category_id uuid references public.family_categories(id) on delete set null,
  account_id text references public.family_accounts(id) on delete set null,
  to_account_id text references public.family_accounts(id) on delete set null,
  owner text not null default '共同' check (owner in ('我', '老婆', '共同')),
  merchant text,
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_transactions_occurred_on_idx
  on public.family_transactions (occurred_on desc);

create index if not exists family_transactions_account_idx
  on public.family_transactions (account_id);

alter table public.family_transactions enable row level security;

-- updated_at trigger (reuse existing function set_updated_at)
drop trigger if exists set_family_transactions_updated_at on public.family_transactions;
create trigger set_family_transactions_updated_at
before update on public.family_transactions
for each row execute function public.set_updated_at();

-- ─── Seed: 支出分類 ────────────────────────────────────────────────────
insert into public.family_categories (name, kind, sort_order, source_app) values
  ('餐飲',     'expense',  1, 'andromoney'),
  ('交通',     'expense',  2, 'andromoney'),
  ('家庭用品', 'expense',  3, 'andromoney'),
  ('育樂',     'expense',  4, 'andromoney'),
  ('醫療',     'expense',  5, 'andromoney'),
  ('教育',     'expense',  6, 'andromoney'),
  ('服飾',     'expense',  7, 'andromoney'),
  ('房貸',     'expense',  8, 'andromoney'),
  ('電信',     'expense',  9, 'andromoney'),
  ('水電瓦斯', 'expense', 10, 'andromoney'),
  ('保險',     'expense', 11, 'andromoney'),
  ('訂閱',     'expense', 12, 'andromoney'),
  ('車輛保養', 'expense', 13, 'andromoney'),
  ('房屋維護', 'expense', 14, 'andromoney'),
  ('利息',     'expense', 15, 'andromoney'),
  ('手續費',   'expense', 16, 'andromoney'),
  ('其他支出', 'expense', 17, 'andromoney')
on conflict do nothing;

-- ─── Seed: 收入分類 ────────────────────────────────────────────────────
insert into public.family_categories (name, kind, sort_order, source_app) values
  ('薪資',     'income', 1, 'andromoney'),
  ('獎金',     'income', 2, 'andromoney'),
  ('利息收入', 'income', 3, 'andromoney'),
  ('投資收入', 'income', 4, 'andromoney'),
  ('退款',     'income', 5, 'andromoney'),
  ('其他收入', 'income', 6, 'andromoney')
on conflict do nothing;

-- ─── Seed: 轉帳分類 ────────────────────────────────────────────────────
insert into public.family_categories (name, kind, sort_order, source_app) values
  ('帳戶轉帳',   'transfer', 1, 'andromoney'),
  ('信用卡還款', 'transfer', 2, 'andromoney'),
  ('投資轉帳',   'transfer', 3, 'andromoney')
on conflict do nothing;
