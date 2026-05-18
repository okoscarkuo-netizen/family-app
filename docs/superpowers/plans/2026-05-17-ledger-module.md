# 帳本模組 (Ledger Module) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立獨立的帳本模組，讓使用者可以新增支出/收入/轉帳記錄並存入 Supabase，取代目前 localStorage 的暫存方式。

**Architecture:** 比照 `family_accounts` 的 passcode-only 架構，建立 `family_categories` 和 `family_transactions` 兩張表，透過 admin client（service role key）存取，不依賴 Supabase Auth。帳本主頁為 Server Component 讀取資料，新增表單為 Client Component，透過 Server Action 寫入。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (`@supabase/supabase-js` admin client), `revalidatePath` + `redirect` for mutations.

---

## 檔案結構

| 動作 | 路徑 | 用途 |
|------|------|------|
| CREATE | `supabase/migrations/20260517000000_family_ledger.sql` | 建立 family_categories、family_transactions 表及 seed 分類 |
| CREATE | `lib/family-transactions.ts` | TypeScript 型別 + Supabase query helpers |
| CREATE | `app/actions/transactions.ts` | Server Actions：新增、刪除交易 |
| CREATE | `app/ledger/_components/TransactionForm.tsx` | 新增交易表單 (Client Component) |
| CREATE | `app/ledger/_components/TransactionList.tsx` | 交易列表（按日期分組） |
| CREATE | `app/ledger/_components/TransactionFilters.tsx` | 月份/帳戶篩選器 (Client Component) |
| CREATE | `app/ledger/new/page.tsx` | 新增交易頁面（Server Component，負責載入 accounts/categories） |
| MODIFY | `app/ledger/page.tsx` | 取代 Dashboard wrapper，改為 Server Component + 篩選 + 列表 |

---

## Task 1：Database Migration

**Files:**
- Create: `supabase/migrations/20260517000000_family_ledger.sql`

- [ ] **Step 1.1：建立 migration 檔案**

```sql
-- supabase/migrations/20260517000000_family_ledger.sql

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
```

- [ ] **Step 1.2：在 Supabase 執行 migration**

到 Supabase Dashboard → SQL Editor，貼上上方 SQL 執行。

**驗證：** Table Editor 中可以看到 `family_categories`（含 26 筆分類）和 `family_transactions`（空表）。

- [ ] **Step 1.3：Commit**

```bash
git add supabase/migrations/20260517000000_family_ledger.sql
git commit -m "db: add family_categories and family_transactions tables with seed categories"
```

---

## Task 2：TypeScript 型別 + Query Helpers

**Files:**
- Create: `lib/family-transactions.ts`

- [ ] **Step 2.1：建立 `lib/family-transactions.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export type TransactionKind = 'income' | 'expense' | 'transfer'
export type TransactionOwner = '我' | '老婆' | '共同'

export type FamilyCategory = {
  id: string
  name: string
  kind: TransactionKind
  icon: string | null
  color: string | null
  sort_order: number
  is_archived: boolean
}

export type FamilyTransaction = {
  id: string
  kind: TransactionKind
  title: string
  amount: number
  currency: string
  category_id: string | null
  account_id: string | null
  to_account_id: string | null
  owner: TransactionOwner
  merchant: string | null
  occurred_on: string
  note: string | null
  created_at: string
  category?: Pick<FamilyCategory, 'id' | 'name' | 'kind'> | null
}

export type GetTransactionsParams = {
  year?: number
  month?: number
  accountId?: string
}

export async function getCategories(kind?: TransactionKind): Promise<FamilyCategory[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from('family_categories')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order')

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as FamilyCategory[]
}

export async function getAllCategories(): Promise<FamilyCategory[]> {
  return getCategories()
}

export async function getTransactions(params: GetTransactionsParams = {}): Promise<FamilyTransaction[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from('family_transactions')
    .select('*, category:family_categories(id, name, kind)')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.year && params.month) {
    const y = params.year
    const m = String(params.month).padStart(2, '0')
    const lastDay = new Date(y, params.month, 0).getDate()
    query = query
      .gte('occurred_on', `${y}-${m}-01`)
      .lte('occurred_on', `${y}-${m}-${lastDay}`)
  }

  if (params.accountId) {
    query = query.or(`account_id.eq.${params.accountId},to_account_id.eq.${params.accountId}`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as FamilyTransaction[]
}
```

- [ ] **Step 2.2：確認型別正確，`createAdminClient` 可以 null（代表環境變數未設定）**

```bash
cd /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App
npx tsc --noEmit
```

期望輸出：無錯誤（或只有原有錯誤，沒有新增的 type error）。

- [ ] **Step 2.3：Commit**

```bash
git add lib/family-transactions.ts
git commit -m "feat: add FamilyTransaction types and Supabase query helpers"
```

---

## Task 3：Server Actions

**Files:**
- Create: `app/actions/transactions.ts`

- [ ] **Step 3.1：建立 `app/actions/transactions.ts`**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function str(val: FormDataEntryValue | null): string {
  return val ? String(val).trim() : ''
}

function nullableStr(val: FormDataEntryValue | null): string | null {
  const s = str(val)
  return s === '' ? null : s
}

export async function createTransaction(formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('Database client unavailable')

  const kind = str(formData.get('kind'))
  if (!['income', 'expense', 'transfer'].includes(kind)) {
    throw new Error(`Invalid kind: ${kind}`)
  }

  const amountRaw = parseFloat(str(formData.get('amount')))
  if (isNaN(amountRaw) || amountRaw <= 0) {
    throw new Error('金額必須大於 0')
  }

  const merchant = nullableStr(formData.get('merchant'))
  const categoryName = str(formData.get('category_name'))
  const title = merchant || categoryName || kind

  const payload = {
    kind,
    title,
    amount: amountRaw,
    currency: str(formData.get('currency')) || 'TWD',
    category_id: nullableStr(formData.get('category_id')),
    account_id: nullableStr(formData.get('account_id')),
    to_account_id: kind === 'transfer' ? nullableStr(formData.get('to_account_id')) : null,
    owner: str(formData.get('owner')) || '共同',
    merchant,
    occurred_on: str(formData.get('occurred_on')) || new Date().toISOString().split('T')[0],
    note: nullableStr(formData.get('note')),
  }

  const { error } = await supabase.from('family_transactions').insert(payload)
  if (error) throw new Error(error.message)

  revalidatePath('/ledger')
  redirect('/ledger')
}

export async function deleteTransaction(id: string) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('Database client unavailable')

  const { error } = await supabase
    .from('family_transactions')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ledger')
}
```

- [ ] **Step 3.2：型別檢查**

```bash
npx tsc --noEmit
```

期望：無新 type error。

- [ ] **Step 3.3：Commit**

```bash
git add app/actions/transactions.ts
git commit -m "feat: add createTransaction and deleteTransaction server actions"
```

---

## Task 4：TransactionForm（表單元件）

**Files:**
- Create: `app/ledger/_components/TransactionForm.tsx`

- [ ] **Step 4.1：建立 `app/ledger/_components/TransactionForm.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { createTransaction } from '@/app/actions/transactions'
import type { FamilyCategory } from '@/lib/family-transactions'
import type { FamilyAccount } from '@/lib/finance/types'

type Kind = 'expense' | 'income' | 'transfer'

const KIND_LABELS: Record<Kind, string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
}

const CURRENCIES = ['TWD', 'USD', 'JPY', 'CNY'] as const
const OWNERS = ['共同', '我', '老婆'] as const

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name' | 'currency'>[]
  categories: FamilyCategory[]
}

export function TransactionForm({ accounts, categories }: Props) {
  const [kind, setKind] = useState<Kind>('expense')
  const [pending, setPending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const filteredCategories = categories.filter(c => c.kind === kind)

  async function handleSubmit(formData: FormData) {
    formData.set('kind', kind)
    const selectedCategory = categories.find(c => c.id === String(formData.get('category_id')))
    if (selectedCategory) formData.set('category_name', selectedCategory.name)
    setPending(true)
    try {
      await createTransaction(formData)
    } finally {
      setPending(false)
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      {/* 交易類型切換 */}
      <div className="flex gap-2">
        {(['expense', 'income', 'transfer'] as Kind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              kind === k
                ? k === 'expense'
                  ? 'bg-red-500 text-white'
                  : k === 'income'
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {/* 金額 + 幣別 */}
      <div className="flex gap-2">
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="金額"
          required
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <select name="currency" defaultValue="TWD" className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 分類 */}
      <select
        name="category_id"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      >
        <option value="">選擇分類</option>
        {filteredCategories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* 帳戶（轉帳時顯示來源+目標，其他只顯示一個） */}
      {kind === 'transfer' ? (
        <div className="flex gap-2 items-center">
          <select name="account_id" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">來源帳戶</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="text-gray-400 text-sm">→</span>
          <select name="to_account_id" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">目標帳戶</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      ) : (
        <select name="account_id" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="">選擇帳戶</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}

      {/* 商家 */}
      <input
        name="merchant"
        type="text"
        placeholder="商家（選填）"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />

      {/* 日期 */}
      <input
        name="occurred_on"
        type="date"
        defaultValue={new Date().toISOString().split('T')[0]}
        required
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />

      {/* 持有人 */}
      <select name="owner" defaultValue="共同" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
        {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>

      {/* 備註 */}
      <input
        name="note"
        type="text"
        placeholder="備註（選填）"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
      >
        {pending ? '新增中…' : '新增'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4.2：型別檢查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4.3：Commit**

```bash
git add app/ledger/_components/TransactionForm.tsx
git commit -m "feat: add TransactionForm client component"
```

---

## Task 5：TransactionList（列表元件）

**Files:**
- Create: `app/ledger/_components/TransactionList.tsx`

- [ ] **Step 5.1：建立 `app/ledger/_components/TransactionList.tsx`**

```tsx
import type { FamilyTransaction, TransactionKind } from '@/lib/family-transactions'
import { deleteTransaction } from '@/app/actions/transactions'

const KIND_COLOR: Record<TransactionKind, string> = {
  expense: 'text-red-500',
  income: 'text-green-600',
  transfer: 'text-blue-500',
}

const KIND_SIGN: Record<TransactionKind, string> = {
  expense: '-',
  income: '+',
  transfer: '⇄',
}

function formatAmount(tx: FamilyTransaction): string {
  const sign = KIND_SIGN[tx.kind]
  const amount = tx.amount.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${sign}${amount} ${tx.currency}`
}

function groupByDate(transactions: FamilyTransaction[]): Array<{ date: string; items: FamilyTransaction[] }> {
  const map = new Map<string, FamilyTransaction[]>()
  for (const tx of transactions) {
    const existing = map.get(tx.occurred_on) ?? []
    map.set(tx.occurred_on, [...existing, tx])
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} ${['日','一','二','三','四','五','六'][d.getDay()]}`
}

type Props = {
  transactions: FamilyTransaction[]
}

export function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        本月還沒有記錄，點右上角「＋ 新增」開始記帳
      </div>
    )
  }

  const groups = groupByDate(transactions)

  return (
    <div className="space-y-4">
      {groups.map(({ date, items }) => (
        <div key={date}>
          <div className="text-xs text-gray-400 font-medium px-1 mb-1">{formatDate(date)}</div>
          <div className="bg-white rounded-xl divide-y divide-gray-50 shadow-sm">
            {items.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {tx.merchant || tx.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {tx.category?.name && <span>{tx.category.name}</span>}
                    {tx.owner && <span className="ml-1">· {tx.owner}</span>}
                  </div>
                </div>
                <span className={`text-sm font-semibold ${KIND_COLOR[tx.kind]} shrink-0`}>
                  {formatAmount(tx)}
                </span>
                <form action={deleteTransaction.bind(null, tx.id)}>
                  <button
                    type="submit"
                    className="text-gray-300 hover:text-red-400 text-xs ml-1"
                    title="刪除"
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5.2：型別檢查**

```bash
npx tsc --noEmit
```

- [ ] **Step 5.3：Commit**

```bash
git add app/ledger/_components/TransactionList.tsx
git commit -m "feat: add TransactionList component with date grouping"
```

---

## Task 6：TransactionFilters（篩選元件）

**Files:**
- Create: `app/ledger/_components/TransactionFilters.tsx`

- [ ] **Step 6.1：建立 `app/ledger/_components/TransactionFilters.tsx`**

篩選器透過 URL search params 傳遞篩選條件，Server Component 重新讀取。

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name'>[]
  currentYear: number
  currentMonth: number
}

export function TransactionFilters({ accounts, currentYear, currentMonth }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/ledger?${params.toString()}`)
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="flex gap-2 items-center">
      <select
        value={currentYear}
        onChange={e => updateParam('year', e.target.value)}
        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
      >
        {years.map(y => <option key={y} value={y}>{y} 年</option>)}
      </select>
      <select
        value={currentMonth}
        onChange={e => updateParam('month', e.target.value)}
        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
      >
        {months.map(m => <option key={m} value={m}>{m} 月</option>)}
      </select>
      <select
        value={searchParams.get('accountId') ?? ''}
        onChange={e => updateParam('accountId', e.target.value)}
        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
      >
        <option value="">全部帳戶</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  )
}
```

- [ ] **Step 6.2：型別檢查**

```bash
npx tsc --noEmit
```

- [ ] **Step 6.3：Commit**

```bash
git add app/ledger/_components/TransactionFilters.tsx
git commit -m "feat: add TransactionFilters client component with URL-based state"
```

---

## Task 7：新增交易頁面

**Files:**
- Create: `app/ledger/new/page.tsx`

- [ ] **Step 7.1：建立 `app/ledger/new/page.tsx`**

```tsx
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllCategories } from '@/lib/family-transactions'
import { TransactionForm } from '@/app/ledger/_components/TransactionForm'
import type { FamilyAccount } from '@/lib/finance/types'

async function getActiveAccounts(): Promise<Pick<FamilyAccount, 'id' | 'name' | 'currency'>[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('family_accounts')
    .select('id, name, currency')
    .eq('is_archived', false)
    .order('sort_order')
  return (data ?? []) as Pick<FamilyAccount, 'id' | 'name' | 'currency'>[]
}

export default async function NewTransactionPage() {
  const [accounts, categories] = await Promise.all([
    getActiveAccounts(),
    getAllCategories(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/ledger" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 返回
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">新增記錄</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <TransactionForm accounts={accounts} categories={categories} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2：型別檢查**

```bash
npx tsc --noEmit
```

- [ ] **Step 7.3：Commit**

```bash
git add app/ledger/new/page.tsx
git commit -m "feat: add new transaction page with account and category loading"
```

---

## Task 8：帳本主頁

**Files:**
- Modify: `app/ledger/page.tsx`

- [ ] **Step 8.1：取代 `app/ledger/page.tsx` 內容**

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { getTransactions } from '@/lib/family-transactions'
import { createAdminClient } from '@/lib/supabase/admin'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { TransactionFilters } from '@/app/ledger/_components/TransactionFilters'
import type { FamilyAccount } from '@/lib/finance/types'

async function getActiveAccounts(): Promise<Pick<FamilyAccount, 'id' | 'name'>[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('family_accounts')
    .select('id, name')
    .eq('is_archived', false)
    .order('sort_order')
  return (data ?? []) as Pick<FamilyAccount, 'id' | 'name'>[]
}

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string; accountId?: string }>
}

export default async function LedgerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()), 10)
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10)
  const accountId = params.accountId || undefined

  const [transactions, accounts] = await Promise.all([
    getTransactions({ year, month, accountId }),
    getActiveAccounts(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800">帳本</h1>
          <Link
            href="/ledger/new"
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            ＋ 新增
          </Link>
        </div>

        {/* 篩選器 */}
        <div className="mb-4">
          <Suspense>
            <TransactionFilters
              accounts={accounts}
              currentYear={year}
              currentMonth={month}
            />
          </Suspense>
        </div>

        {/* 列表 */}
        <TransactionList transactions={transactions} />
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2：型別檢查**

```bash
npx tsc --noEmit
```

- [ ] **Step 8.3：啟動開發伺服器，手動驗證**

```bash
npm run dev
```

1. 打開 `http://localhost:3000/ledger`
   - 期望：顯示帳本頁面，有篩選器和「＋ 新增」按鈕，列表顯示「本月還沒有記錄」
2. 點「＋ 新增」→ 跳到 `/ledger/new`
   - 期望：顯示表單，切換支出/收入/轉帳，分類下拉列表會變動
3. 填入一筆支出（金額: 100, 分類: 餐飲, 日期: 今天）→ 送出
   - 期望：跳回 `/ledger`，列表顯示剛才新增的記錄
4. 點 ✕ 刪除該筆記錄
   - 期望：記錄消失，列表回到空白提示

- [ ] **Step 8.4：Commit**

```bash
git add app/ledger/page.tsx
git commit -m "feat: replace ledger page with proper Server Component connected to Supabase"
```

---

## Task 9：最終整合驗證

- [ ] **Step 9.1：執行完整型別檢查**

```bash
npx tsc --noEmit
```

期望：無 type error。

- [ ] **Step 9.2：執行 lint**

```bash
npm run lint
```

期望：無 error（warning 可忽略）。

- [ ] **Step 9.3：手動測試黃金路徑**

打開 `http://localhost:3000/ledger`，執行以下測試：

| 操作 | 期望結果 |
|------|---------|
| 新增支出 300 元，餐飲，共同信用卡，商家「全聯」| 列表顯示，金額紅色 -300 TWD |
| 新增收入 80000 元，薪資，薪轉戶，持有人「我」| 列表顯示，金額綠色 +80,000 TWD |
| 新增轉帳 48000 元，帳戶轉帳，來源→目標帳戶 | 列表顯示，金額藍色 ⇄48,000 TWD |
| 切換到上個月篩選 | 列表清空（無資料）|
| 切回本月 | 三筆記錄重新顯示 |
| 刪除一筆 | 列表即時更新 |

- [ ] **Step 9.4：最終 Commit**

```bash
git add -A
git commit -m "feat: complete ledger module with Supabase integration"
```

---

## 環境變數確認

實作前確保 `.env.local` 含有：

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   ← admin client 必須，缺少會讓所有查詢回傳空值
FAMILY_APP_PASSCODE=...
```

`SUPABASE_SERVICE_ROLE_KEY` 若未設定，`createAdminClient()` 回傳 `null`，所有讀寫靜默失敗（不會 crash，但資料不會存）。

---

## 後續迭代（本計畫範圍外）

- **月結摘要**：本月收入/支出/淨額統計卡片
- **分類管理**：新增/編輯分類頁面
- **AndroMoney 歷史匯入**：`import_batches` + `import_raw_rows` 流程
- **信用卡帳單對帳**：匯入 CSV，比對 merchant/amount 自動標記
