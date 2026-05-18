# Accounts Page Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `dashboard.tsx` wrapper at `/accounts` with a standalone Server Component page backed by Supabase `family_accounts`, with full CRUD via modals.

**Architecture:** New `lib/accounts-db.ts` for DB queries → `app/actions/accounts.ts` for Server Actions → Client Components (`AccountList`, `AccountCard`, `AccountModal`) mounted under a Server Component page. The existing `/api/accounts` REST route stays untouched for `dashboard.tsx` compatibility.

**Tech Stack:** Next.js 16 Server Components, Server Actions, Tailwind CSS 4, Supabase (admin client via `createAdminClient()`).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/accounts-db.ts` | Create | DB query helpers: `getAccounts`, `getAccountById` |
| `app/actions/accounts.ts` | Create | Server Actions: `createAccount`, `updateAccount`, `archiveAccount` |
| `app/accounts/_components/AccountCard.tsx` | Create | Single account card (display + edit trigger) |
| `app/accounts/_components/AccountModal.tsx` | Create | Add/edit modal (Client Component) |
| `app/accounts/_components/AccountList.tsx` | Create | Groups + net worth bar + modal state (Client Component) |
| `app/accounts/page.tsx` | Rewrite | Server Component: fetch + render `AccountList` |
| `app/accounts/[id]/page.tsx` | Rewrite | Server Component: account detail + transaction list |

---

## Task 1: lib/accounts-db.ts

**Files:**
- Create: `lib/accounts-db.ts`

- [ ] **Step 1: Create the file**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { accountFromRow, accountToRow, initialAccounts } from '@/lib/accounts'
import type { AccountRow } from '@/lib/accounts'
import type { FamilyAccount } from '@/lib/finance/types'

export async function getAccounts(): Promise<FamilyAccount[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, name, type, owner, kind, balance, currency, hidden, sort_order')
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return []

  // Seed from initialAccounts on first use (mirrors /api/accounts GET behaviour)
  if (!data?.length) {
    const rows = initialAccounts.map(accountToRow)
    await supabase.from('family_accounts').upsert(rows, { onConflict: 'id' })
    return initialAccounts
  }

  return data.map(row => accountFromRow(row as AccountRow))
}

export async function getAccountById(id: string): Promise<FamilyAccount | null> {
  const supabase = createAdminClient()
  if (!supabase) return null

  const { data } = await supabase
    .from('family_accounts')
    .select('id, name, type, owner, kind, balance, currency, hidden, sort_order')
    .eq('id', id)
    .eq('is_archived', false)
    .single()

  if (!data) return null
  return accountFromRow(data as AccountRow)
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors related to `lib/accounts-db.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/accounts-db.ts
git commit -m "feat: add accounts-db query helpers with auto-seed"
```

---

## Task 2: app/actions/accounts.ts

**Files:**
- Create: `app/actions/accounts.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_CURRENCIES = new Set(['TWD', 'USD', 'JPY', 'CNY'])

function getString(formData: FormData, key: string, fallback = ''): string {
  return String(formData.get(key) ?? fallback).trim()
}

export async function createAccount(formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const name = getString(formData, 'name')
  if (!name) throw new Error('名稱必填')

  const currency = VALID_CURRENCIES.has(getString(formData, 'currency'))
    ? getString(formData, 'currency')
    : 'TWD'
  const kind = getString(formData, 'kind') === 'liability' ? 'liability' : 'asset'
  const balance = Math.max(0, Number(formData.get('balance') ?? 0))

  const { data: maxRow } = await supabase
    .from('family_accounts')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()
  const sortOrder = (maxRow?.sort_order ?? 0) + 1

  const id = `manual-${Date.now()}-${name.slice(0, 20).replace(/\s+/g, '-')}`

  const { error } = await supabase.from('family_accounts').insert({
    id,
    name,
    type: getString(formData, 'type') || '現金',
    owner: getString(formData, 'owner') || '共同',
    kind,
    balance,
    currency,
    hidden: formData.get('hidden') === 'true',
    sort_order: sortOrder,
    is_archived: false,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}

export async function updateAccount(id: string, formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const name = getString(formData, 'name')
  if (!name) throw new Error('名稱必填')

  const currency = VALID_CURRENCIES.has(getString(formData, 'currency'))
    ? getString(formData, 'currency')
    : 'TWD'
  const kind = getString(formData, 'kind') === 'liability' ? 'liability' : 'asset'
  const balance = Math.max(0, Number(formData.get('balance') ?? 0))

  const { error } = await supabase
    .from('family_accounts')
    .update({
      name,
      type: getString(formData, 'type') || '現金',
      owner: getString(formData, 'owner') || '共同',
      kind,
      balance,
      currency,
      hidden: formData.get('hidden') === 'true',
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath(`/accounts/${id}`)
}

export async function archiveAccount(id: string) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const { error } = await supabase
    .from('family_accounts')
    .update({ is_archived: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions/accounts.ts
git commit -m "feat: add account server actions (create, update, archive)"
```

---

## Task 3: AccountCard component

**Files:**
- Create: `app/accounts/_components/AccountCard.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import Link from 'next/link'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = {
  account: FamilyAccount
  onEdit: (account: FamilyAccount) => void
}

export function AccountCard({ account, onEdit }: Props) {
  const balanceStr = account.balance.toLocaleString('zh-TW', {
    maximumFractionDigits: 2,
  })

  return (
    <div className="flex items-center gap-3 rounded-md border-2 border-slate-950 bg-white p-3 shadow-[3px_3px_0_#111827]">
      <Link href={`/accounts/${encodeURIComponent(account.id)}`} className="min-w-0 flex-1">
        <p className="truncate font-black text-slate-950">{account.name}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          {account.type} · {account.owner}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-black text-slate-950">
          {balanceStr} <span className="text-xs font-semibold text-slate-400">{account.currency}</span>
        </span>
        <button
          onClick={() => onEdit(account)}
          className="rounded-md border-2 border-slate-950 bg-white px-2 py-1 text-xs hover:bg-[#fff45f]"
          type="button"
          aria-label={`編輯 ${account.name}`}
        >
          ✎
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/accounts/_components/AccountCard.tsx
git commit -m "feat: add AccountCard component"
```

---

## Task 4: AccountModal component

**Files:**
- Create: `app/accounts/_components/AccountModal.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'
import { accountTypes, accountOwners, accountCurrencies } from '@/lib/finance/types'
import { createAccount, updateAccount, archiveAccount } from '@/app/actions/accounts'

type Props = {
  mode: 'create' | 'edit'
  account?: FamilyAccount
  onClose: () => void
}

const INPUT_CLASS =
  'mt-1 w-full rounded-md border-2 border-slate-950 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-[#00c2ff]'

export function AccountModal({ mode, account, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createAccount(formData)
        } else {
          await updateAccount(account!.id, formData)
        }
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '發生錯誤，請再試一次')
      }
    })
  }

  function handleArchive() {
    setError(null)
    startTransition(async () => {
      try {
        await archiveAccount(account!.id)
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '封存失敗')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-slate-950 bg-white p-6 shadow-[8px_8px_0_#00c2ff]">
        <h2 className="text-lg font-black">
          {mode === 'create' ? '新增帳戶' : '編輯帳戶'}
        </h2>

        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <form action={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-black text-slate-600">名稱 *</span>
            <input
              name="name"
              defaultValue={account?.name ?? ''}
              required
              className={INPUT_CLASS}
            />
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">類型</span>
            <select name="type" defaultValue={account?.type ?? '現金'} className={INPUT_CLASS}>
              {accountTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">歸屬</span>
            <select name="owner" defaultValue={account?.owner ?? '共同'} className={INPUT_CLASS}>
              {accountOwners.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-xs font-black text-slate-600">性質</legend>
            <div className="mt-1 flex gap-4">
              {(['asset', 'liability'] as const).map(k => (
                <label key={k} className="flex items-center gap-1.5 text-sm font-semibold">
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    defaultChecked={account ? account.kind === k : k === 'asset'}
                  />
                  {k === 'asset' ? '資產' : '負債'}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-black text-slate-600">幣別</span>
            <select name="currency" defaultValue={account?.currency ?? 'TWD'} className={INPUT_CLASS}>
              {accountCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">起始餘額</span>
            <input
              name="balance"
              type="number"
              min="0"
              step="0.01"
              defaultValue={account?.balance ?? 0}
              className={INPUT_CLASS}
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="hidden"
              value="true"
              defaultChecked={account?.hidden ?? false}
              className="size-4"
            />
            隱藏此帳戶
          </label>

          <div className="mt-5 flex items-center justify-between">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isPending}
                className="rounded-md border-2 border-slate-950 bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                封存帳戶
              </button>
            )}
            <div className={`flex gap-2 ${mode === 'edit' ? '' : 'ml-auto'}`}>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-sm font-black hover:bg-[#e9fbff]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md border-2 border-slate-950 bg-[#00c2ff] px-4 py-2 text-sm font-black hover:bg-[#69dbff] disabled:opacity-50"
              >
                {isPending ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/accounts/_components/AccountModal.tsx
git commit -m "feat: add AccountModal for create/edit/archive"
```

---

## Task 5: AccountList component

**Files:**
- Create: `app/accounts/_components/AccountList.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useState } from 'react'
import type { FamilyAccount } from '@/lib/finance/types'
import { accountGroupOrder, getAccountGroup } from '@/lib/finance/types'
import { AccountCard } from './AccountCard'
import { AccountModal } from './AccountModal'

type Props = {
  accounts: FamilyAccount[]
}

function fmt(n: number): string {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

export function AccountList({ accounts }: Props) {
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingAccount, setEditingAccount] = useState<FamilyAccount | null>(null)

  function openCreate() {
    setEditingAccount(null)
    setModalMode('create')
  }

  function openEdit(account: FamilyAccount) {
    setEditingAccount(account)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingAccount(null)
  }

  const assetTotal = accounts
    .filter(a => a.kind === 'asset')
    .reduce((sum, a) => sum + a.balance, 0)
  const liabilityTotal = accounts
    .filter(a => a.kind === 'liability')
    .reduce((sum, a) => sum + a.balance, 0)
  const net = assetTotal - liabilityTotal

  const visibleAccounts = accounts.filter(a => !a.hidden)
  const groupedAccounts = accountGroupOrder
    .map(group => ({
      group,
      items: visibleAccounts.filter(a => getAccountGroup(a) === group),
    }))
    .filter(g => g.items.length > 0)

  return (
    <>
      {/* Net Worth Bar */}
      <div className="rounded-lg border-2 border-slate-950 bg-[#00c2ff] p-4 shadow-[6px_6px_0_#111827]">
        <p className="mb-3 text-xs font-black uppercase text-slate-700">
          淨資產總覽
          {accounts.some(a => a.currency !== 'TWD') && (
            <span className="ml-2 font-semibold normal-case text-slate-600">（多幣別混算，僅供參考）</span>
          )}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border-2 border-slate-950 bg-white p-3">
            <p className="text-xs font-bold text-slate-500">資產</p>
            <p className="mt-1 text-lg font-black text-slate-950">{fmt(assetTotal)}</p>
          </div>
          <div className="rounded-md border-2 border-slate-950 bg-white p-3">
            <p className="text-xs font-bold text-slate-500">負債</p>
            <p className="mt-1 text-lg font-black text-slate-950">{fmt(liabilityTotal)}</p>
          </div>
          <div className="rounded-md border-2 border-slate-950 bg-[#fff45f] p-3">
            <p className="text-xs font-bold text-slate-500">淨值</p>
            <p className={`mt-1 text-lg font-black ${net < 0 ? 'text-red-600' : 'text-slate-950'}`}>
              {fmt(net)}
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">帳戶與資產</h2>
          <p className="mt-0.5 text-sm text-slate-500">{visibleAccounts.length} 個帳戶</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2 text-sm font-black text-white shadow-[4px_4px_0_#111827] hover:bg-[#e92b87]"
          type="button"
        >
          ＋ 新增帳戶
        </button>
      </div>

      {/* Groups */}
      <div className="space-y-6">
        {groupedAccounts.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            還沒有帳戶，點右上角「＋ 新增帳戶」開始
          </p>
        )}
        {groupedAccounts.map(({ group, items }) => (
          <div key={group}>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
              {group}
            </h3>
            <div className="space-y-2">
              {items.map(account => (
                <AccountCard key={account.id} account={account} onEdit={openEdit} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalMode && (
        <AccountModal
          mode={modalMode}
          account={editingAccount ?? undefined}
          onClose={closeModal}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/accounts/_components/AccountList.tsx
git commit -m "feat: add AccountList with net worth bar and grouped display"
```

---

## Task 6: app/accounts/page.tsx (rewrite)

**Files:**
- Modify: `app/accounts/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the entire content with:

```typescript
import { getAccounts } from '@/lib/accounts-db'
import { AccountList } from './_components/AccountList'

export default async function AccountsPage() {
  const accounts = await getAccounts()

  return (
    <main className="min-h-screen bg-[#faf7f0] text-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-5">
          <AccountList accounts={accounts} />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds (or shows only pre-existing errors unrelated to accounts).

- [ ] **Step 3: Start dev server and verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/accounts` and verify:
- Net worth bar shows three cards (資產 / 負債 / 淨值)
- Accounts appear grouped by 7 categories
- "＋ 新增帳戶" button opens modal
- Modal has all required fields
- Saving a new account refreshes the list

- [ ] **Step 4: Commit**

```bash
git add app/accounts/page.tsx
git commit -m "feat: replace accounts wrapper with Server Component backed by Supabase"
```

---

## Task 7: app/accounts/[id]/page.tsx (rewrite)

**Files:**
- Modify: `app/accounts/[id]/page.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the entire content with:

```typescript
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccountById } from '@/lib/accounts-db'
import { getTransactions } from '@/lib/family-transactions'
import type { FamilyTransaction } from '@/lib/family-transactions'

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
  const [account, transactions] = await Promise.all([
    getAccountById(decodeURIComponent(id)),
    getTransactions({ accountId: decodeURIComponent(id) }),
  ])

  if (!account) notFound()

  return (
    <main className="min-h-screen bg-[#faf7f0] text-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 rounded-md border-2 border-slate-950 bg-white px-3 py-1.5 text-xs font-black hover:bg-[#fff45f]"
        >
          ← 返回帳戶列表
        </Link>

        {/* Account info card */}
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

        {/* Transaction list */}
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
    </main>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds.

- [ ] **Step 3: Verify in browser**

Open any account card link and verify:
- Account info card shows correctly
- "此帳戶還沒有交易記錄" message appears (expected since data is empty)
- "← 返回帳戶列表" link works

- [ ] **Step 4: Commit**

```bash
git add app/accounts/[id]/page.tsx
git commit -m "feat: add account detail page as Server Component"
```

---

## Task 8: Verify CRUD end-to-end

- [ ] **Step 1: Test new account creation**

In browser at `http://localhost:3000/accounts`:
1. Click "＋ 新增帳戶"
2. Fill in: 名稱="測試帳戶", 類型=現金, 歸屬=共同, 性質=資產, 幣別=TWD, 起始餘額=1000
3. Click 儲存
4. Verify new account appears in the list under the correct group

- [ ] **Step 2: Test edit**

1. Click ✎ on any account
2. Change the name
3. Click 儲存
4. Verify name updated in list

- [ ] **Step 3: Test archive**

1. Click ✎ on "測試帳戶" created in Step 1
2. Click "封存帳戶"
3. Verify account disappears from list

- [ ] **Step 4: Verify ledger dropdown**

Open `http://localhost:3000/ledger/new` and verify the accounts dropdown is now populated with accounts.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete accounts page upgrade with full CRUD"
```
