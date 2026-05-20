alter table public.family_categories
  add column if not exists parent_id uuid references public.family_categories(id) on delete set null;

alter table public.family_categories
  drop constraint if exists family_categories_parent_self_check;

alter table public.family_categories
  add constraint family_categories_parent_self_check
  check (parent_id is null or parent_id <> id);

create index if not exists family_categories_parent_sort_idx
  on public.family_categories (kind, parent_id, sort_order);

with ranked_categories as (
  select
    id,
    first_value(id) over (
      partition by kind, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)
      order by sort_order asc, created_at asc, id asc
    ) as keep_id,
    row_number() over (
      partition by kind, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)
      order by sort_order asc, created_at asc, id asc
    ) as duplicate_rank
  from public.family_categories
),
duplicate_categories as (
  select id, keep_id
  from ranked_categories
  where duplicate_rank > 1
)
update public.family_transactions as tx
set category_id = duplicate_categories.keep_id
from duplicate_categories
where tx.category_id = duplicate_categories.id;

with ranked_categories as (
  select
    id,
    row_number() over (
      partition by kind, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)
      order by sort_order asc, created_at asc, id asc
    ) as duplicate_rank
  from public.family_categories
)
delete from public.family_categories as category
using ranked_categories
where category.id = ranked_categories.id
  and ranked_categories.duplicate_rank > 1;

create unique index if not exists family_categories_kind_parent_name_unique
  on public.family_categories (
    kind,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create table if not exists public.family_merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  last_used_at timestamptz not null default now(),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists family_merchants_normalized_name_unique
  on public.family_merchants (normalized_name);

create index if not exists family_merchants_last_used_idx
  on public.family_merchants (last_used_at desc);

alter table public.family_merchants enable row level security;

drop trigger if exists set_family_merchants_updated_at on public.family_merchants;
create trigger set_family_merchants_updated_at
before update on public.family_merchants
for each row execute function public.set_updated_at();

alter table public.family_transactions
  add column if not exists merchant_id uuid references public.family_merchants(id) on delete set null;

create index if not exists family_transactions_merchant_idx
  on public.family_transactions (merchant_id);

create or replace function public.touch_family_merchant(
  p_name text,
  p_last_used_at timestamptz default now()
)
returns uuid
language plpgsql
as $$
declare
  normalized text;
  merchant_uuid uuid;
begin
  normalized := lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));

  if normalized = '' then
    return null;
  end if;

  insert into public.family_merchants (name, normalized_name, last_used_at, is_archived)
  values (trim(p_name), normalized, p_last_used_at, false)
  on conflict (normalized_name) do update
    set name = excluded.name,
        last_used_at = greatest(public.family_merchants.last_used_at, excluded.last_used_at),
        is_archived = false
  returning id into merchant_uuid;

  return merchant_uuid;
end;
$$;

update public.family_transactions
set merchant_id = public.touch_family_merchant(merchant, coalesce(occurred_at, created_at))
where merchant_id is null
  and nullif(trim(coalesce(merchant, '')), '') is not null;

with expense_children(parent_name, child_name, child_sort_order) as (
  values
    ('餐飲', '早餐', 1),
    ('餐飲', '午餐', 2),
    ('餐飲', '晚餐', 3),
    ('餐飲', '咖啡飲料', 4),
    ('餐飲', '點心宵夜', 5),
    ('交通', '加油', 1),
    ('交通', '停車', 2),
    ('交通', '過路費', 3),
    ('交通', '大眾運輸', 4),
    ('交通', '計程車', 5),
    ('家庭用品', '居家採買', 1),
    ('家庭用品', '清潔用品', 2),
    ('家庭用品', '日用品', 3),
    ('育樂', '旅遊', 1),
    ('育樂', '娛樂', 2),
    ('育樂', '玩具', 3),
    ('醫療', '掛號', 1),
    ('醫療', '藥品', 2),
    ('醫療', '保健', 3),
    ('教育', '學費', 1),
    ('教育', '書籍課程', 2),
    ('教育', '才藝', 3),
    ('服飾', '衣物', 1),
    ('服飾', '鞋包', 2),
    ('服飾', '配件', 3),
    ('房貸', '本金', 1),
    ('房貸', '利息', 2),
    ('電信', '手機', 1),
    ('電信', '網路', 2),
    ('水電瓦斯', '水費', 1),
    ('水電瓦斯', '電費', 2),
    ('水電瓦斯', '瓦斯', 3),
    ('水電瓦斯', '垃圾處理', 4),
    ('保險', '醫療險', 1),
    ('保險', '車險', 2),
    ('保險', '房屋險', 3),
    ('保險', '壽險', 4),
    ('訂閱', '影音串流', 1),
    ('訂閱', '軟體服務', 2),
    ('訂閱', '會員方案', 3),
    ('車輛保養', '保養維修', 1),
    ('車輛保養', '輪胎耗材', 2),
    ('車輛保養', '洗車美容', 3),
    ('房屋維護', '空調保養', 1),
    ('房屋維護', '濾芯耗材', 2),
    ('房屋維護', '修繕工程', 3),
    ('房屋維護', 'HOA', 4),
    ('利息', '信用卡利息', 1),
    ('利息', '貸款利息', 2),
    ('手續費', '轉帳手續費', 1),
    ('手續費', '平台手續費', 2),
    ('其他支出', '未分類支出', 1),
    ('其他支出', '臨時支出', 2)
),
expense_parents as (
  select id, name
  from public.family_categories
  where kind = 'expense'
    and parent_id is null
),
missing_expense_children as (
  select
    parent.id as parent_id,
    child.child_name,
    child.child_sort_order
  from expense_children child
  join expense_parents parent on parent.name = child.parent_name
  left join public.family_categories existing
    on existing.kind = 'expense'
   and existing.parent_id = parent.id
   and lower(existing.name) = lower(child.child_name)
  where existing.id is null
)
insert into public.family_categories (name, kind, parent_id, sort_order, source_app)
select child_name, 'expense', parent_id, child_sort_order, 'family-app'
from missing_expense_children;

with income_children(parent_name, child_name, child_sort_order) as (
  values
    ('薪資', '月薪', 1),
    ('薪資', '津貼', 2),
    ('獎金', '年終獎金', 1),
    ('獎金', '其他獎金', 2),
    ('利息收入', '銀行利息', 1),
    ('利息收入', '配息利息', 2),
    ('投資收入', '股息', 1),
    ('投資收入', '資本利得', 2),
    ('退款', '購物退款', 1),
    ('退款', '帳單沖回', 2),
    ('其他收入', '轉售收入', 1),
    ('其他收入', '禮金補貼', 2)
),
income_parents as (
  select id, name
  from public.family_categories
  where kind = 'income'
    and parent_id is null
),
missing_income_children as (
  select
    parent.id as parent_id,
    child.child_name,
    child.child_sort_order
  from income_children child
  join income_parents parent on parent.name = child.parent_name
  left join public.family_categories existing
    on existing.kind = 'income'
   and existing.parent_id = parent.id
   and lower(existing.name) = lower(child.child_name)
  where existing.id is null
)
insert into public.family_categories (name, kind, parent_id, sort_order, source_app)
select child_name, 'income', parent_id, child_sort_order, 'family-app'
from missing_income_children;

with transfer_children(parent_name, child_name, child_sort_order) as (
  values
    ('帳戶轉帳', '一般調度', 1),
    ('帳戶轉帳', '儲蓄轉移', 2),
    ('信用卡還款', '全額繳款', 1),
    ('信用卡還款', '部分繳款', 2),
    ('投資轉帳', '入金', 1),
    ('投資轉帳', '出金', 2)
),
transfer_parents as (
  select id, name
  from public.family_categories
  where kind = 'transfer'
    and parent_id is null
),
missing_transfer_children as (
  select
    parent.id as parent_id,
    child.child_name,
    child.child_sort_order
  from transfer_children child
  join transfer_parents parent on parent.name = child.parent_name
  left join public.family_categories existing
    on existing.kind = 'transfer'
   and existing.parent_id = parent.id
   and lower(existing.name) = lower(child.child_name)
  where existing.id is null
)
insert into public.family_categories (name, kind, parent_id, sort_order, source_app)
select child_name, 'transfer', parent_id, child_sort_order, 'family-app'
from missing_transfer_children;
