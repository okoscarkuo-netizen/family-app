# UI 優化實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加共用底部 Tab Bar、統一 Neobrutalist 視覺風格、首頁改為三卡片摘要。

**Architecture:** 新建 `components/BottomNav.tsx` Client Component，各頁面個別引入（不放在 layout，避免 login 頁出現 Tab Bar）。首頁拆成三個獨立卡片元件從 Supabase 讀取資料，提醒卡先用靜態空狀態。帳本頁套用 neobrutalist 底色與按鈕樣式。

**Tech Stack:** Next.js 15 App Router、Tailwind CSS、`usePathname()`（Client Component）、Supabase admin client

---

## 檔案清單

| 動作 | 路徑 | 說明 |
|------|------|------|
| **新建** | `components/BottomNav.tsx` | 共用底部 tab bar（Client Component） |
| **新建** | `app/_components/NetWorthCard.tsx` | 淨資產摘要卡 |
| **新建** | `app/_components/MonthlySummaryCard.tsx` | 本月收支摘要卡 |
| **新建** | `app/_components/UpcomingRemindersCard.tsx` | 即將提醒卡（靜態空狀態） |
| **修改** | `app/page.tsx` | 首頁改為 Server Component |
| **修改** | `app/accounts/page.tsx` | 加 BottomNav + pb-20 |
| **修改** | `app/accounts/[id]/page.tsx` | 加 BottomNav + pb-20 |
| **修改** | `app/ledger/page.tsx` | 統一 neobrutalist 風格 + 加 BottomNav |

---

## Task 1: BottomNav 元件

**Files:**
- Create: `components/BottomNav.tsx`

- [ ] 建立 `components/` 目錄並新增 `components/BottomNav.tsx`：

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/',          icon: '🏠', label: '首頁' },
  { href: '/accounts',  icon: '💳', label: '帳戶' },
  { href: '/ledger',    icon: '📒', label: '帳本' },
  { href: '/reminders', icon: '🔔', label: '提醒' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-slate-950 bg-white">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center py-2 transition-colors ${
                active
                  ? 'border-t-[3px] border-slate-950 bg-[#faf7f0]'
                  : 'border-t-[3px] border-transparent'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className={`mt-0.5 text-[10px] ${active ? 'font-black text-slate-950' : 'font-semibold text-slate-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] 確認 TypeScript 無 error：`npx tsc --noEmit`
- [ ] Commit：
```bash
git add components/BottomNav.tsx
git commit -m "feat: add BottomNav component"
```

---

## Task 2: 帳戶頁加 BottomNav

**Files:**
- Modify: `app/accounts/page.tsx`
- Modify: `app/accounts/[id]/page.tsx`

- [ ] 完整取代 `app/accounts/page.tsx`：

```tsx
import { getAccounts } from '@/lib/accounts-db'
import { AccountList } from './_components/AccountList'
import { BottomNav } from '@/components/BottomNav'

export default async function AccountsPage() {
  const accounts = await getAccounts()

  return (
    <main className="min-h-screen bg-[#faf7f0] pb-20 text-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-5">
          <AccountList accounts={accounts} />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
```

- [ ] 完整取代 `app/accounts/[id]/page.tsx`：

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccountById } from '@/lib/accounts-db'
import { getTransactions } from '@/lib/family-transactions'
import type { FamilyTransaction } from '@/lib/family-transactions'
import { BottomNav } from '@/components/BottomNav'

function AmountLabel({ tx }: { tx: FamilyTransaction }) {
  const colorClass =
    tx.kind === 'income' ? 'text-green-600' : tx.kind === 'expense' ? 'text-red-500' : 'text-blue-500'
  const sign = tx.kind === 'income' ? '+' : tx.kind === 'expense' ? '-' : '⇄'
  return (
    <span className={`text-sm font-black ${colorClass}`}>
      {sign}{tx.amount.toLocaleString('zh-TW')} {tx.currency}
    </span>
  )
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const account = await getAccountById(decodeURIComponent(id))
  if (!account) notFound()

  const transactions = await getTransactions({ accountId: account.id })

  return (
    <main className="min-h-screen bg-[#faf7f0] pb-20 text-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 rounded-md border-2 border-slate-950 bg-white px-3 py-1.5 text-xs font-black hover:bg-[#fff45f]"
        >
          ← 返回帳戶列表
        </Link>

        <div className="mt-4 rounded-lg border-2 border-slate-950 bg-white p-5 shadow-[6px_6px_0_#00c2ff]">
          <h1 className="text-xl font-black">{account.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {[account.type, account.owner, account.currency, account.kind === 'asset' ? '資產' : '負債'].map(tag => (
              <span
                key={tag}
                className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-4 text-3xl font-black">
            {account.balance.toLocaleString('zh-TW')}
            <span className="ml-2 text-base font-semibold text-slate-400">{account.currency}</span>
          </p>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-sm font-black text-slate-600">交易記錄</h2>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">此帳戶還沒有交易記錄</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div
                  key={tx.id}
                  className="rounded-md border-2 border-slate-950 bg-white p-3 shadow-[3px_3px_0_#111827]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-950">
                      {tx.title || tx.merchant || '無標題'}
                    </span>
                    <AmountLabel tx={tx} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {tx.occurred_on} · {tx.category?.name ?? '未分類'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
```

- [ ] 開啟 http://localhost:3000/accounts，確認底部 Tab Bar 出現、「💳 帳戶」高亮
- [ ] 點任一帳戶進入明細頁，確認 Tab Bar 仍顯示且「💳 帳戶」仍高亮
- [ ] 確認 TypeScript 無 error：`npx tsc --noEmit`
- [ ] Commit：
```bash
git add app/accounts/page.tsx app/accounts/[id]/page.tsx
git commit -m "feat: add BottomNav to accounts pages"
```

---

## Task 3: 帳本頁 Neobrutalist 風格 + BottomNav

**Files:**
- Modify: `app/ledger/page.tsx`

- [ ] 完整取代 `app/ledger/page.tsx`：

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { getTransactions } from '@/lib/family-transactions'
import { createAdminClient } from '@/lib/supabase/admin'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { TransactionFilters } from '@/app/ledger/_components/TransactionFilters'
import { BottomNav } from '@/components/BottomNav'
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
    <main className="min-h-screen bg-[#faf7f0] pb-20">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-lg font-black text-slate-950">帳本</h1>
          <Link
            href="/ledger/new"
            className="rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_#111827] hover:bg-[#e92b87]"
          >
            ＋ 新增
          </Link>
        </div>

        <div className="mb-4">
          <Suspense>
            <TransactionFilters
              accounts={accounts}
              currentYear={year}
              currentMonth={month}
            />
          </Suspense>
        </div>

        <TransactionList transactions={transactions} />
      </div>
      <BottomNav />
    </main>
  )
}
```

- [ ] 開啟 http://localhost:3000/ledger，確認：
  - 背景是米黃色 `#faf7f0`（不再是 `bg-gray-50`）
  - 「＋ 新增」按鈕是粉紅色 + 黑邊框 + 陰影
  - 底部 Tab Bar 顯示且「📒 帳本」高亮
- [ ] Commit：
```bash
git add app/ledger/page.tsx
git commit -m "feat: apply neobrutalist style and add BottomNav to ledger page"
```

---

## Task 4: 首頁三張卡片元件

**Files:**
- Create: `app/_components/NetWorthCard.tsx`
- Create: `app/_components/MonthlySummaryCard.tsx`
- Create: `app/_components/UpcomingRemindersCard.tsx`

- [ ] 建立 `app/_components/NetWorthCard.tsx`：

```tsx
import Link from 'next/link'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = { accounts: FamilyAccount[] }

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

export function NetWorthCard({ accounts }: Props) {
  const visible = accounts.filter(a => !a.hidden)
  const assets = visible.filter(a => a.kind === 'asset').reduce((s, a) => s + a.balance, 0)
  const liabilities = visible.filter(a => a.kind === 'liability').reduce((s, a) => s + a.balance, 0)
  const net = assets - liabilities
  const multiCurrency = accounts.some(a => a.currency !== 'TWD')

  return (
    <Link href="/accounts" className="block">
      <div className="rounded-xl border-2 border-slate-950 bg-[#00c2ff] p-4 shadow-[4px_4px_0_#111827] transition-shadow hover:shadow-[6px_6px_0_#111827]">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-700">
          💰 淨資產
          {multiCurrency && <span className="ml-1 font-semibold normal-case">（多幣別混算）</span>}
        </p>
        <p className={`mb-3 text-2xl font-black ${net < 0 ? 'text-red-600' : 'text-slate-950'}`}>
          ${fmt(net)}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border-2 border-slate-950 bg-white p-2">
            <p className="text-[10px] font-bold text-slate-500">資產</p>
            <p className="text-sm font-black text-slate-950">${fmt(assets)}</p>
          </div>
          <div className="rounded-lg border-2 border-slate-950 bg-white p-2">
            <p className="text-[10px] font-bold text-slate-500">負債</p>
            <p className="text-sm font-black text-slate-950">${fmt(liabilities)}</p>
          </div>
        </div>
        <p className="mt-2 text-right text-[10px] text-slate-700 opacity-70">→ 查看帳戶</p>
      </div>
    </Link>
  )
}
```

- [ ] 建立 `app/_components/MonthlySummaryCard.tsx`：

```tsx
import Link from 'next/link'
import type { FamilyTransaction } from '@/lib/family-transactions'

type Props = {
  transactions: FamilyTransaction[]
  month: number
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

export function MonthlySummaryCard({ transactions, month }: Props) {
  const income = transactions.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense
  const savingRatio = income > 0 ? Math.min((income - expense) / income, 1) : 0

  return (
    <Link href="/ledger" className="block">
      <div className="rounded-xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_#111827] transition-shadow hover:shadow-[6px_6px_0_#111827]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-slate-700">
          📒 {month}月收支
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border-2 border-slate-950 bg-[#dcfce7] p-2">
            <p className="text-[10px] font-bold text-green-700">收入</p>
            <p className="text-sm font-black text-green-800">+${fmt(income)}</p>
          </div>
          <div className="rounded-lg border-2 border-slate-950 bg-[#fee2e2] p-2">
            <p className="text-[10px] font-bold text-red-700">支出</p>
            <p className="text-sm font-black text-red-800">-${fmt(expense)}</p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          <div
            className="h-full rounded-full bg-[#22c55e] transition-all"
            style={{ width: `${Math.round(savingRatio * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[10px] text-slate-500">結餘 ${fmt(balance)}</p>
          <p className="text-[10px] text-slate-700 opacity-70">→ 查看帳本</p>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] 建立 `app/_components/UpcomingRemindersCard.tsx`（靜態空狀態，提醒系統建好後再接 DB）：

```tsx
import Link from 'next/link'

export function UpcomingRemindersCard() {
  return (
    <Link href="/reminders" className="block">
      <div className="rounded-xl border-2 border-slate-950 bg-[#fff45f] p-4 shadow-[4px_4px_0_#111827] transition-shadow hover:shadow-[6px_6px_0_#111827]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-slate-700">
          🔔 即將到期
        </p>
        <p className="py-4 text-center text-sm text-slate-500">尚無待辦提醒</p>
        <p className="text-right text-[10px] text-slate-700 opacity-70">→ 查看提醒</p>
      </div>
    </Link>
  )
}
```

- [ ] 確認 TypeScript 無 error：`npx tsc --noEmit`
- [ ] Commit：
```bash
git add app/_components/
git commit -m "feat: add home summary card components"
```

---

## Task 5: 首頁改寫

**Files:**
- Modify: `app/page.tsx`

- [ ] 完整取代 `app/page.tsx`：

```tsx
import { getAccounts } from '@/lib/accounts-db'
import { getTransactions } from '@/lib/family-transactions'
import { NetWorthCard } from '@/app/_components/NetWorthCard'
import { MonthlySummaryCard } from '@/app/_components/MonthlySummaryCard'
import { UpcomingRemindersCard } from '@/app/_components/UpcomingRemindersCard'
import { BottomNav } from '@/components/BottomNav'

export default async function HomePage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [accounts, transactions] = await Promise.all([
    getAccounts(),
    getTransactions({ year, month }),
  ])

  return (
    <main className="min-h-screen bg-[#faf7f0] pb-20">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">家庭中控</p>
          <h1 className="text-xl font-black text-slate-950">{month}月 概覽</h1>
        </div>
        <div className="space-y-4">
          <NetWorthCard accounts={accounts} />
          <MonthlySummaryCard transactions={transactions} month={month} />
          <UpcomingRemindersCard />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
```

- [ ] 開啟 http://localhost:3000，確認：
  - 舊 Dashboard 不再出現
  - 3 張摘要卡片（藍/白/黃）正常顯示
  - 「🏠 首頁」tab 高亮
  - 帳戶卡可點進 `/accounts`、帳本卡可點進 `/ledger`、提醒卡可點進 `/reminders`
- [ ] 在瀏覽器縮到 375px 寬（手機尺寸），確認各卡片顯示正常、Tab Bar 觸控範圍合適
- [ ] 確認 TypeScript 無 error：`npx tsc --noEmit`
- [ ] Commit：
```bash
git add app/page.tsx
git commit -m "feat: rewrite home page as summary Server Component"
```

---

## 最終驗收

- [ ] 從首頁逐一點 Tab：🏠 → 💳 → 📒 → 🔔 → 🏠，確認導航順暢
- [ ] 帳戶明細頁 `/accounts/[id]` 的「💳 帳戶」tab 高亮（`startsWith('/accounts')` 邏輯）
- [ ] `npx tsc --noEmit` 全部通過
- [ ] Push 到 GitHub：`git push`
