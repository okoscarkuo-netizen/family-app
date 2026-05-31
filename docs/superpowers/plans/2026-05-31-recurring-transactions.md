# 定期交易（Recurring Transactions）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者在「記一筆」加上隱藏式「＋ 週期」標籤即可設定定期交易，到日由 Vercel Cron 自動產生新交易，並提供「更多 → 定期交易」管理頁。

**Architecture:** 新表 `recurring_transactions` 存模板規則；`family_transactions` 加 `recurring_id` 欄位指回模板。每天 07:00 PT 跑 cron 把所有 `next_due_date <= today` 的模板補產生交易（漏跑保護由 while 迴圈處理）。UI 整合進現有 `TransactionForm`，新增管理頁 `/recurring`。

**Tech Stack:** Next.js 16 App Router、React 19、Supabase Postgres（DB trigger 自動更新帳戶餘額）、Vercel Cron、TypeScript。本專案無單元測試，每個任務以 `npx tsc --noEmit` + `npm run build` + Vercel preview 手動驗證。

---

## File Responsibility Map

| 檔案 | 責任 |
|---|---|
| `supabase/migrations/20260531000000_recurring_transactions.sql` | 建表 + 加欄位 |
| `lib/recurring-db.ts` | 型別定義、查詢 helper、`computeNextDueDate`、cron 產生邏輯 |
| `app/actions/recurring.ts` | Server actions（CRUD + toggle） |
| `app/actions/transactions.ts` | 修改：`createTransaction` 接受 `recurringConfig` |
| `app/ledger/_components/TransactionForm.tsx` | UI：「＋ 週期」chip 與展開區塊 |
| `app/recurring/page.tsx` | 管理頁 server component |
| `app/recurring/_components/RecurringList.tsx` | 列表 + 卡片 client component |
| `app/more/page.tsx` | 加「定期交易」入口 |
| `app/api/cron/recurring-transactions/route.ts` | Cron API endpoint |
| `vercel.json` | 加 cron 排程 |

---

## Task 1: DB Migration — 建表與加欄位

**Files:**
- Create: `supabase/migrations/20260531000000_recurring_transactions.sql`

- [ ] **Step 1: 寫 migration SQL**

寫入以下內容到 `supabase/migrations/20260531000000_recurring_transactions.sql`：

```sql
-- Recurring transactions templates
create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount numeric(18, 4) not null check (amount >= 0),
  currency text not null check (currency in ('TWD', 'USD', 'JPY')),
  account_id uuid not null references public.family_accounts(id) on delete cascade,
  target_account_id uuid references public.family_accounts(id) on delete cascade,
  target_amount numeric(18, 4),
  target_currency text check (target_currency in ('TWD', 'USD', 'JPY')),
  category_id uuid references public.family_categories(id) on delete set null,
  merchant_id uuid references public.family_merchants(id) on delete set null,
  owner text not null check (owner in ('Oscar', 'Livia')),
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date not null,
  next_due_date date not null,
  end_type text not null default 'forever' check (end_type in ('forever', 'count')),
  end_count integer,
  generated_count integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for cron lookup
create index if not exists recurring_transactions_active_due_idx
  on public.recurring_transactions (is_active, next_due_date)
  where is_active = true;

-- Link generated transactions back to template
alter table public.family_transactions
  add column if not exists recurring_id uuid references public.recurring_transactions(id) on delete set null;

-- Update timestamp trigger
create or replace function public.set_recurring_transactions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_recurring_transactions_updated_at on public.recurring_transactions;
create trigger set_recurring_transactions_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_recurring_transactions_updated_at();
```

- [ ] **Step 2: 套用 migration 到本地與 production**

請使用者執行：
```bash
npx supabase db push
```

預期：兩個變更套用成功（新表 + 加欄位）。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260531000000_recurring_transactions.sql
git commit -m "feat(db): 定期交易表與 family_transactions.recurring_id"
```

---

## Task 2: 共用型別與日期工具 `lib/recurring-db.ts`（純函式部分）

**Files:**
- Create: `lib/recurring-db.ts`

- [ ] **Step 1: 寫型別與 `computeNextDueDate`**

建立 `lib/recurring-db.ts`：

```ts
import { createAdminClient } from '@/lib/supabase/admin'

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type EndType = 'forever' | 'count'

export type RecurringTransaction = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  accountId: string
  targetAccountId: string | null
  targetAmount: number | null
  targetCurrency: string | null
  categoryId: string | null
  merchantId: string | null
  owner: 'Oscar' | 'Livia'
  frequency: Frequency
  startDate: string
  nextDueDate: string
  endType: EndType
  endCount: number | null
  generatedCount: number
  isActive: boolean
  notes: string | null
  accountName: string | null
  targetAccountName: string | null
  categoryName: string | null
  merchantName: string | null
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const originalDay = date.getDate()
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const day = Math.min(originalDay, lastDay)
  return new Date(targetYear, normalizedMonth, day, 12)
}

export function computeNextDueDate(currentDate: string, frequency: Frequency): string {
  const date = parseDate(currentDate)
  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7)
    return formatDate(date)
  }
  if (frequency === 'monthly') return formatDate(addMonthsClamped(date, 1))
  if (frequency === 'quarterly') return formatDate(addMonthsClamped(date, 3))
  return formatDate(addMonthsClamped(date, 12))
}
```

- [ ] **Step 2: 用 tsc 檢查**

```bash
npx tsc --noEmit
```

預期：通過（無錯誤輸出）。

- [ ] **Step 3: Commit**

```bash
git add lib/recurring-db.ts
git commit -m "feat(recurring): 型別與日期計算工具 computeNextDueDate"
```

---

## Task 3: 查詢與單筆讀取 helper

**Files:**
- Modify: `lib/recurring-db.ts`（在檔案末加上）

- [ ] **Step 1: 加上 `getRecurringTransactions` 與 `getRecurringTransactionById`**

在 `lib/recurring-db.ts` 末加：

```ts
type RowJoined = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  account_id: string
  target_account_id: string | null
  target_amount: number | null
  target_currency: string | null
  category_id: string | null
  merchant_id: string | null
  owner: 'Oscar' | 'Livia'
  frequency: Frequency
  start_date: string
  next_due_date: string
  end_type: EndType
  end_count: number | null
  generated_count: number
  is_active: boolean
  notes: string | null
  family_accounts: { name: string } | null
  target_account: { name: string } | null
  family_categories: { name: string } | null
  family_merchants: { name: string } | null
}

function rowToRecurring(row: RowJoined): RecurringTransaction {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    amount: Number(row.amount),
    currency: row.currency,
    accountId: row.account_id,
    targetAccountId: row.target_account_id,
    targetAmount: row.target_amount === null ? null : Number(row.target_amount),
    targetCurrency: row.target_currency,
    categoryId: row.category_id,
    merchantId: row.merchant_id,
    owner: row.owner,
    frequency: row.frequency,
    startDate: row.start_date,
    nextDueDate: row.next_due_date,
    endType: row.end_type,
    endCount: row.end_count,
    generatedCount: row.generated_count,
    isActive: row.is_active,
    notes: row.notes,
    accountName: row.family_accounts?.name ?? null,
    targetAccountName: row.target_account?.name ?? null,
    categoryName: row.family_categories?.name ?? null,
    merchantName: row.family_merchants?.name ?? null,
  }
}

const SELECT_QUERY = `
  id, name, kind, amount, currency, account_id, target_account_id, target_amount,
  target_currency, category_id, merchant_id, owner, frequency, start_date,
  next_due_date, end_type, end_count, generated_count, is_active, notes,
  family_accounts!recurring_transactions_account_id_fkey ( name ),
  target_account:family_accounts!recurring_transactions_target_account_id_fkey ( name ),
  family_categories ( name ),
  family_merchants ( name )
`

export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(SELECT_QUERY)
    .order('is_active', { ascending: false })
    .order('next_due_date', { ascending: true })
  if (error) {
    console.error('getRecurringTransactions error:', error.message)
    return []
  }
  return ((data ?? []) as unknown as RowJoined[]).map(rowToRecurring)
}

export async function getRecurringTransactionById(id: string): Promise<RecurringTransaction | null> {
  const supabase = createAdminClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(SELECT_QUERY)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return rowToRecurring(data as unknown as RowJoined)
}
```

- [ ] **Step 2: tsc 檢查**

```bash
npx tsc --noEmit
```

預期：通過。

- [ ] **Step 3: Commit**

```bash
git add lib/recurring-db.ts
git commit -m "feat(recurring): 查詢 helper getRecurringTransactions / getRecurringTransactionById"
```

---

## Task 4: Cron 產生邏輯 `generateDueRecurringTransactions`

**Files:**
- Modify: `lib/recurring-db.ts`（末段）

- [ ] **Step 1: 加上 cron 主邏輯**

在 `lib/recurring-db.ts` 末加：

```ts
function todayInPhoenix(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export type GenerateResult = {
  generated: number
  templatesProcessed: number
  errors: string[]
}

export async function generateDueRecurringTransactions(): Promise<GenerateResult> {
  const supabase = createAdminClient()
  if (!supabase) return { generated: 0, templatesProcessed: 0, errors: ['no admin client'] }

  const today = todayInPhoenix()
  const errors: string[] = []
  let generated = 0
  let templatesProcessed = 0

  const { data: dueTemplates, error: queryErr } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .lte('next_due_date', today)
  if (queryErr) return { generated: 0, templatesProcessed: 0, errors: [queryErr.message] }

  for (const tmpl of dueTemplates ?? []) {
    templatesProcessed++
    let nextDue: string = tmpl.next_due_date
    let generatedCount = tmpl.generated_count
    let isActive = true

    while (nextDue <= today && isActive) {
      const occurredAtIso = new Date(`${nextDue}T12:00:00`).toISOString()
      const insertRow: Record<string, unknown> = {
        kind: tmpl.kind,
        title: tmpl.name,
        amount: tmpl.amount,
        currency: tmpl.currency,
        account_id: tmpl.account_id,
        to_account_id: tmpl.target_account_id,
        transfer_target_amount: tmpl.target_amount,
        transfer_target_currency: tmpl.target_currency,
        category_id: tmpl.category_id,
        merchant_id: tmpl.merchant_id,
        owner: tmpl.owner,
        occurred_on: nextDue,
        occurred_at: occurredAtIso,
        note: tmpl.notes,
        recurring_id: tmpl.id,
      }

      const { error: insertErr } = await supabase.from('family_transactions').insert(insertRow)
      if (insertErr) {
        errors.push(`template ${tmpl.id} insert failed: ${insertErr.message}`)
        break
      }
      generated++
      generatedCount++

      if (tmpl.end_type === 'count' && tmpl.end_count !== null && generatedCount >= tmpl.end_count) {
        isActive = false
        break
      }
      nextDue = computeNextDueDate(nextDue, tmpl.frequency)
    }

    const { error: updateErr } = await supabase
      .from('recurring_transactions')
      .update({
        next_due_date: nextDue,
        generated_count: generatedCount,
        is_active: isActive,
      })
      .eq('id', tmpl.id)
    if (updateErr) errors.push(`template ${tmpl.id} update failed: ${updateErr.message}`)
  }

  return { generated, templatesProcessed, errors }
}
```

- [ ] **Step 2: tsc 檢查**

```bash
npx tsc --noEmit
```

預期：通過。

- [ ] **Step 3: Commit**

```bash
git add lib/recurring-db.ts
git commit -m "feat(recurring): cron 產生邏輯 generateDueRecurringTransactions"
```

---

## Task 5: Cron API endpoint + vercel.json

**Files:**
- Create: `app/api/cron/recurring-transactions/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: 建立 cron API**

建立 `app/api/cron/recurring-transactions/route.ts`：

```ts
import { generateDueRecurringTransactions } from '@/lib/recurring-db'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'missing_cron_secret' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateDueRecurringTransactions()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: 加 cron 排程到 `vercel.json`**

修改 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/cron/exchange-rates",
      "schedule": "10 5 * * *"
    },
    {
      "path": "/api/cron/recurring-transactions",
      "schedule": "0 14 * * *"
    }
  ]
}
```

（14:00 UTC = 07:00 Phoenix）

- [ ] **Step 3: tsc + build 檢查**

```bash
npx tsc --noEmit && npm run build
```

預期：build 成功，輸出含 `ƒ /api/cron/recurring-transactions`。

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/recurring-transactions/route.ts vercel.json
git commit -m "feat(recurring): cron API + Vercel 排程 07:00 PT"
```

---

## Task 6: Server actions（CRUD + toggle）

**Files:**
- Create: `app/actions/recurring.ts`

- [ ] **Step 1: 建立 server actions**

建立 `app/actions/recurring.ts`：

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { computeNextDueDate, type Frequency, type EndType } from '@/lib/recurring-db'

export type RecurringInput = {
  name: string
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  accountId: string
  targetAccountId: string | null
  targetAmount: number | null
  targetCurrency: string | null
  categoryId: string | null
  merchantId: string | null
  owner: 'Oscar' | 'Livia'
  frequency: Frequency
  startDate: string
  endType: EndType
  endCount: number | null
  notes: string | null
}

export type RecurringResult = { ok: true; id: string } | { ok: false; error: string }

function validate(input: RecurringInput): string | null {
  if (!input.name.trim()) return '名稱不能空白'
  if (!input.accountId) return '請選擇帳戶'
  if (input.kind === 'transfer' && !input.targetAccountId) return '轉帳必須選目的帳戶'
  if (input.amount <= 0) return '金額必須大於 0'
  if (input.endType === 'count' && (!input.endCount || input.endCount < 1)) return '結束次數必須是正整數'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return '起始日期格式錯誤'
  return null
}

export async function createRecurringTransaction(input: RecurringInput): Promise<RecurringResult> {
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }

  const nextDue = computeNextDueDate(input.startDate, input.frequency)

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      name: input.name.trim(),
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
      account_id: input.accountId,
      target_account_id: input.targetAccountId,
      target_amount: input.targetAmount,
      target_currency: input.targetCurrency,
      category_id: input.categoryId,
      merchant_id: input.merchantId,
      owner: input.owner,
      frequency: input.frequency,
      start_date: input.startDate,
      next_due_date: nextDue,
      end_type: input.endType,
      end_count: input.endCount,
      generated_count: 1,
      is_active: true,
      notes: input.notes,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  revalidatePath('/more')
  return { ok: true, id: data.id }
}

export async function updateRecurringTransaction(id: string, input: RecurringInput): Promise<RecurringResult> {
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }

  const { error } = await supabase
    .from('recurring_transactions')
    .update({
      name: input.name.trim(),
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
      account_id: input.accountId,
      target_account_id: input.targetAccountId,
      target_amount: input.targetAmount,
      target_currency: input.targetCurrency,
      category_id: input.categoryId,
      merchant_id: input.merchantId,
      owner: input.owner,
      frequency: input.frequency,
      end_type: input.endType,
      end_count: input.endCount,
      notes: input.notes,
    })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  return { ok: true, id }
}

export async function deleteRecurringTransaction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  return { ok: true }
}

export async function toggleRecurringTransaction(id: string, isActive: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }
  const { error } = await supabase.from('recurring_transactions').update({ is_active: isActive }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  return { ok: true }
}
```

- [ ] **Step 2: tsc 檢查**

```bash
npx tsc --noEmit
```

預期：通過。

- [ ] **Step 3: Commit**

```bash
git add app/actions/recurring.ts
git commit -m "feat(recurring): server actions CRUD + toggle"
```

---

## Task 7: 「更多」頁加入口

**Files:**
- Modify: `app/more/page.tsx`

- [ ] **Step 1: 加入「定期交易」常用入口**

開 `app/more/page.tsx`，找到 `quickLinks` 陣列，在 `'/merchants'` 後加：

```tsx
{
  href: '/recurring',
  title: '定期交易',
  description: '管理已建立的定期規則（暫停 / 編輯 / 刪除）。',
},
```

- [ ] **Step 2: tsc + build 檢查**

```bash
npx tsc --noEmit && npm run build
```

預期：通過，路由清單含 `/recurring`（之後 Task 8 會建）。

> 注意：此時 `/recurring` 還沒建立，會 404，但連結存在不會 build 失敗。

- [ ] **Step 3: Commit**

```bash
git add app/more/page.tsx
git commit -m "feat(recurring): 更多頁加「定期交易」入口"
```

---

## Task 8: 定期交易管理頁（含 CRUD UI）

**Files:**
- Create: `app/recurring/page.tsx`
- Create: `app/recurring/_components/RecurringList.tsx`

- [ ] **Step 1: 建 server component 頁面**

建立 `app/recurring/page.tsx`：

```tsx
import { BottomNav } from '@/components/BottomNav'
import { getRecurringTransactions } from '@/lib/recurring-db'
import { RecurringList } from './_components/RecurringList'

export const dynamic = 'force-dynamic'

export default async function RecurringPage() {
  const items = await getRecurringTransactions()
  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
            <div className="flex h-[4.5rem] items-center px-5">
              <h1 className="text-[1.35rem] font-semibold tracking-normal text-[#202124]">定期交易</h1>
            </div>
          </header>
          <RecurringList items={items} />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
```

- [ ] **Step 2: 建 client component**

建立 `app/recurring/_components/RecurringList.tsx`：

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RecurringTransaction } from '@/lib/recurring-db'
import { deleteRecurringTransaction, toggleRecurringTransaction } from '@/app/actions/recurring'

const FREQ_LABELS: Record<string, string> = {
  weekly: '每週',
  monthly: '每月',
  quarterly: '每季',
  yearly: '每年',
}

function formatMoney(amount: number, currency: string) {
  const value = amount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'TWD' ? `NT$${value}` : `${value} ${currency}`
}

export function RecurringList({ items }: { items: RecurringTransaction[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm font-bold text-slate-400">
        還沒有定期交易。<br />在「記一筆」勾選「＋ 週期」即可建立。
      </div>
    )
  }

  function handleToggle(id: string, currentActive: boolean) {
    setBusyId(id)
    startTransition(async () => {
      await toggleRecurringTransaction(id, !currentActive)
      router.refresh()
      setBusyId(null)
    })
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`確定刪除「${name}」？已產生的歷史交易會保留。`)) return
    setBusyId(id)
    startTransition(async () => {
      await deleteRecurringTransaction(id)
      router.refresh()
      setBusyId(null)
    })
  }

  return (
    <div className="space-y-3 p-4">
      {items.map((it) => {
        const isIncome = it.kind === 'income'
        const meta = [
          FREQ_LABELS[it.frequency],
          it.categoryName,
          it.accountName,
        ].filter(Boolean).join(' · ')
        const remaining = it.endType === 'count' && it.endCount
          ? `${it.generatedCount}/${it.endCount} 次`
          : `已記 ${it.generatedCount} 筆`
        return (
          <div
            key={it.id}
            className={`rounded-[1.2rem] border p-4 ${
              it.isActive ? 'border-[#ece4d8] bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[1rem] font-black text-slate-900">{it.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black ${
                      it.isActive ? 'bg-[#e6f5ec] text-[#187d5f]' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {it.isActive ? '啟用中' : '已暫停'}
                  </span>
                </div>
                <div className="mt-1 text-[0.78rem] font-bold text-slate-500">{meta}</div>
              </div>
              <div className={`shrink-0 text-right text-[1rem] font-black ${isIncome ? 'text-[#15957d]' : 'text-slate-900'}`}>
                {isIncome ? '+' : ''}{formatMoney(it.amount, it.currency)}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
              <div className="text-[0.72rem] font-bold text-slate-500">
                下次：<span className="text-slate-900">{it.isActive ? it.nextDueDate : '已暫停'}</span>　·　{remaining}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggle(it.id, it.isActive)}
                  disabled={busyId === it.id}
                  className="rounded-full bg-[#f4f1ea] px-3 py-1 text-[0.7rem] font-black text-slate-700 disabled:opacity-50"
                >
                  {it.isActive ? '暫停' : '啟用'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(it.id, it.name)}
                  disabled={busyId === it.id}
                  className="rounded-full bg-[#fff1ee] px-3 py-1 text-[0.7rem] font-black text-[#c9563f] disabled:opacity-50"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: tsc + build 檢查**

```bash
npx tsc --noEmit && npm run build
```

預期：通過，輸出含 `ƒ /recurring`。

- [ ] **Step 4: 部署 preview 與目視驗證**

```bash
git add app/recurring/
git commit -m "feat(recurring): 管理頁 /recurring 含暫停/啟用/刪除"
git push
npx vercel deploy
```

開啟 preview URL，登入後點「更多」→「定期交易」，應該看到「還沒有定期交易」提示（因為還沒辦法建立）。

---

## Task 9: 記一筆表單加「＋ 週期」chip + 展開區塊

**Files:**
- Modify: `app/ledger/_components/TransactionForm.tsx`

> 注意：此 Task 只在「新增模式」下加入週期 chip，編輯模式（既有交易）暫不顯示。後續 Task 10 處理連動到 server action。

- [ ] **Step 1: 在 TransactionForm 內加入 state 與 UI**

打開 `app/ledger/_components/TransactionForm.tsx`，在主元件函式 `TransactionForm` 內 hook state 區域加：

```tsx
const [recurringOn, setRecurringOn] = useState(false)
const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
const [recurringEndType, setRecurringEndType] = useState<'forever' | 'count'>('forever')
const [recurringEndCount, setRecurringEndCount] = useState<number>(12)
```

找到備註欄之後、儲存按鈕之前的位置（搜尋 `MerchantFieldRow` 後或 `note` 欄附近），加入：

```tsx
{!isEditMode ? (
  !recurringOn ? (
    <div className="px-5 py-4">
      <button
        type="button"
        onClick={() => setRecurringOn(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#d8c4a0] bg-[#fff8ed] px-3 py-1.5 text-[0.78rem] font-black text-[#a37a1c] active:bg-[#fdeacf]"
      >
        <span>＋</span>
        <span>週期</span>
      </button>
    </div>
  ) : (
    <div className="border-t border-[#efebe4] bg-[#fff8ed] px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🔁</span>
          <span className="text-[0.95rem] font-black text-slate-900">週期設定</span>
        </div>
        <button
          type="button"
          onClick={() => setRecurringOn(false)}
          className="rounded-full bg-white px-3 py-1 text-[0.72rem] font-black text-slate-500"
        >
          移除
        </button>
      </div>

      <div className="mb-3">
        <div className="mb-2 text-[0.72rem] font-black tracking-[0.12em] text-slate-500">頻率</div>
        <div className="grid grid-cols-4 gap-1.5">
          {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setRecurringFrequency(f)}
              className={`rounded-full py-2 text-[0.85rem] font-black ${
                recurringFrequency === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'
              }`}
            >
              {f === 'weekly' ? '每週' : f === 'monthly' ? '每月' : f === 'quarterly' ? '每季' : '每年'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-2 text-[0.72rem] font-black tracking-[0.12em] text-slate-500">結束方式</div>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setRecurringEndType('forever')}
            className={`flex w-full items-center justify-between rounded-[1rem] px-4 py-2.5 text-left ${
              recurringEndType === 'forever' ? 'bg-white shadow-sm' : 'bg-transparent'
            }`}
          >
            <span className="text-[0.95rem] font-black text-slate-900">一直重複</span>
            <span className={`h-4 w-4 rounded-full border-2 ${
              recurringEndType === 'forever' ? 'border-[#d8a72a] bg-[#d8a72a]' : 'border-slate-300'
            }`} />
          </button>
          <div className={`flex items-center justify-between rounded-[1rem] px-4 py-2.5 ${
            recurringEndType === 'count' ? 'bg-white shadow-sm' : 'bg-transparent'
          }`}>
            <button
              type="button"
              onClick={() => setRecurringEndType('count')}
              className="flex flex-1 items-center gap-2 text-left"
            >
              <span className="text-[0.95rem] font-black text-slate-900">共</span>
              <input
                type="number"
                min="1"
                value={recurringEndCount}
                onChange={(e) => setRecurringEndCount(Math.max(1, Number(e.target.value)))}
                onFocus={() => setRecurringEndType('count')}
                className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-[0.95rem] font-black text-slate-900 outline-none"
              />
              <span className="text-[0.95rem] font-black text-slate-900">次</span>
            </button>
            <span className={`h-4 w-4 rounded-full border-2 ${
              recurringEndType === 'count' ? 'border-[#d8a72a] bg-[#d8a72a]' : 'border-slate-300'
            }`} />
          </div>
        </div>
      </div>
    </div>
  )
) : null}
```

- [ ] **Step 2: tsc + build 檢查**

```bash
npx tsc --noEmit && npm run build
```

預期：通過。

- [ ] **Step 3: Commit**

```bash
git add app/ledger/_components/TransactionForm.tsx
git commit -m "feat(recurring): 記一筆加「＋ 週期」chip 與展開設定（UI only）"
```

---

## Task 10: 串接：表單儲存時呼叫 createRecurringTransaction

**Files:**
- Modify: `app/ledger/_components/TransactionForm.tsx`

- [ ] **Step 1: import createRecurringTransaction 並在 handleSubmit 串接**

在 `TransactionForm.tsx` 檔首加：

```tsx
import { createRecurringTransaction } from '@/app/actions/recurring'
```

找到 `handleSubmit` 函式（呼叫 `createTransaction` / `updateTransaction` 之處）。在「儲存原本交易」成功後、`router.push` 前，加：

```tsx
if (!isEditMode && recurringOn && resolvedCategoryId) {
  const startDate = occurredAt.slice(0, 10)
  const recurringResult = await createRecurringTransaction({
    name: merchant || resolvedCategoryName || '定期交易',
    kind: transactionKind,
    amount: Number(amount),
    currency,
    accountId: resolvedAccountId,
    targetAccountId: transactionKind === 'transfer' ? toAccountId || null : null,
    targetAmount: transactionKind === 'transfer' ? Number(transferTargetAmount) : null,
    targetCurrency: transactionKind === 'transfer' ? transferTargetCurrency : null,
    categoryId: resolvedCategoryId,
    merchantId: null,
    owner,
    frequency: recurringFrequency,
    startDate,
    endType: recurringEndType,
    endCount: recurringEndType === 'count' ? recurringEndCount : null,
    notes: note || null,
  })
  if (!recurringResult.ok) {
    console.error('createRecurringTransaction failed:', recurringResult.error)
    // 交易已建立，定期模板失敗不擋使用者流程；只記錄
  }
}
```

> 變數名 `resolvedCategoryName`、`transferTargetAmount`、`transferTargetCurrency`、`toAccountId`、`note`、`merchant`、`amount`、`occurredAt` 都是 `TransactionForm` 既有變數，照原本檔內命名取用。

- [ ] **Step 2: tsc + build 檢查**

```bash
npx tsc --noEmit && npm run build
```

預期：通過。若 TypeScript 報變數名不存在，請依該檔實際變數調整。

- [ ] **Step 3: 部署 preview 並手動驗證**

```bash
git add app/ledger/_components/TransactionForm.tsx
git commit -m "feat(recurring): 表單儲存時連動建立定期模板"
git push
npx vercel deploy
```

開啟 preview，登入後：
1. 進「記一筆」→ 填寫 NT$390、分類「訂閱」、商家 Netflix
2. 點「＋ 週期」→ 每月、一直重複
3. 儲存
4. 進「更多」→「定期交易」應看到一張卡片「Netflix / 每月 / NT$390 / 下次：下個月同一天」
5. 流水帳應有今天那筆 NT$390

---

## Task 11: 整合驗證 + 部署正式

**Files:** （無變更，只驗證）

- [ ] **Step 1: 手動驗證所有情境**

在 preview URL 上逐項驗證：

| 情境 | 預期 |
|---|---|
| 建立 Netflix 每月、一直重複 | 流水有今天那筆、定期管理頁顯示卡片 |
| 暫停那張卡片 | 標籤變「已暫停」，cron 不會再產生 |
| 啟用那張卡片 | 標籤變「啟用中」 |
| 建立車貸每月共 12 次 | 卡片顯示「1/12 次」 |
| 刪除卡片 | 卡片消失，流水歷史交易保留 |
| 編輯模式（流水帳點交易進來編輯）| 不顯示「＋ 週期」chip（因為 `isEditMode = true`） |

- [ ] **Step 2: 詢問使用者是否部署正式**

依 AGENTS.md 規則：

> 「每次修改完成後，一律主動詢問使用者是否要部署到 https://family-app-ruddy-one.vercel.app」

跟使用者確認沒問題後：

```bash
npx vercel deploy --prod
```

- [ ] **Step 3: 在 Vercel 設定 CRON_SECRET（若還沒設）**

提醒使用者：環境變數 `CRON_SECRET` 必須在 production 與 preview 都有設，cron 才能跑。Vercel 排程會自動帶 `Authorization: Bearer <CRON_SECRET>`。

---

## 注意事項

- **Cron 第一次自動執行**：要等到設定後的下一個 14:00 UTC（07:00 PT）才會自動跑。要立刻測可手動 curl：
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://family-app-ruddy-one.vercel.app/api/cron/recurring-transactions
  ```

- **DB Migration 部署**：Task 1 的 migration 需要使用者執行 `npx supabase db push` 才會套用到 production。實作前請先確認此步完成，否則所有 server actions / cron 都會壞。

- **`/preview/recurring` mockup 頁面**：實作完成後可保留供日後比對，亦可刪除。本 plan 不主動處理。

- **編輯既有定期模板**：本 plan 不包含「進管理頁→編輯→開啟 TransactionForm 編輯模式」的功能，因為 TransactionForm 的編輯模式目前只認 `family_transactions`。若要支援編輯模板，需另開 plan 設計編輯介面。
