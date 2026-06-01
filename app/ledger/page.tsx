import { getTransactions } from '@/lib/family-transactions'
import { createAdminClient } from '@/lib/supabase/admin'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { BottomNav } from '@/components/BottomNav'
import { LedgerViewport } from '@/app/ledger/_components/LedgerViewport'
import {
  formatLedgerTitle,
  getLedgerRange,
  parseLedgerView,
  resolveLedgerAnchorDate,
} from '@/app/ledger/_lib/period'
import type { FamilyAccount } from '@/lib/finance/types'

const DEFAULT_VISIBLE_TRANSACTIONS = 120
const VISIBLE_TRANSACTION_STEP = 120

async function getActiveAccounts(): Promise<Pick<FamilyAccount, 'id' | 'name' | 'hidden'>[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('family_accounts')
    .select('id, name, hidden')
    .eq('is_archived', false)
    .order('sort_order')
  return (data ?? []) as Pick<FamilyAccount, 'id' | 'name' | 'hidden'>[]
}

type PageProps = {
  searchParams: Promise<{ view?: string; date?: string; year?: string; month?: string; accountId?: string; q?: string; take?: string }>
}

export default async function LedgerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const view = parseLedgerView(params.view)
  const anchorDate = resolveLedgerAnchorDate({
    date: params.date,
    year: params.year,
    month: params.month,
    fallback: now,
  })
  const periodRange = getLedgerRange(view, anchorDate)
  const accountId = params.accountId || undefined
  const isSearchMode = params.q !== undefined
  const queryRaw = params.q ?? ''
  const queryTrimmed = queryRaw.trim()
  const visibleLimit = parseVisibleLimit(params.take)

  const [transactions, allAccounts] = await Promise.all([
    getTransactions({
      startDate: isSearchMode ? undefined : formatDate(periodRange.start),
      endDate: isSearchMode ? undefined : formatDate(periodRange.end),
      accountId,
      query: queryTrimmed || undefined,
    }),
    getActiveAccounts(),
  ])
  const visibleAccounts = allAccounts.filter((account) => !account.hidden)
  const selectedAccount = allAccounts.find((account) => account.id === accountId)
  const accountLabel = selectedAccount?.name ?? '全部帳戶'
  const recordLabel = `${transactions.length.toLocaleString('zh-TW')} 筆`
  const visibleTransactions = transactions.slice(0, visibleLimit)
  const hasMoreTransactions = visibleTransactions.length < transactions.length
  const loadMoreHref = hasMoreTransactions
    ? buildLedgerLoadMoreHref(params, Math.min(transactions.length, visibleLimit + VISIBLE_TRANSACTION_STEP))
    : undefined
  const periodTitle = formatLedgerTitle(view, anchorDate)
  const summary = transactions.reduce(
    (acc, transaction) => {
      if (transaction.kind === 'income') acc.income += Math.abs(transaction.amount)
      if (transaction.kind === 'expense') acc.expense += Math.abs(transaction.amount)
      return acc
    },
    { income: 0, expense: 0 },
  )
  const netAmount = summary.income - summary.expense

  return (
    <>
      <LedgerViewport
        view={view}
        anchorDate={formatDate(anchorDate)}
        periodTitle={periodTitle}
        netAmount={netAmount}
        recordLabel={isSearchMode ? `${recordLabel}` : recordLabel}
        accountLabel={accountLabel}
        isSearchMode={isSearchMode}
        queryRaw={queryRaw}
        accounts={visibleAccounts}
        currentAccountId={accountId}
      >
        <div className="flex-1 overflow-y-auto">
          <TransactionList
            transactions={visibleTransactions}
            accounts={allAccounts}
            currentAccountId={accountId}
            totalCount={transactions.length}
            loadMoreHref={loadMoreHref}
          />
        </div>
      </LedgerViewport>
      <BottomNav />
    </>
  )
}

function parseVisibleLimit(value: string | undefined) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_VISIBLE_TRANSACTIONS
  return Math.max(DEFAULT_VISIBLE_TRANSACTIONS, Math.floor(parsed))
}

function buildLedgerLoadMoreHref(
  params: Awaited<PageProps['searchParams']>,
  take: number,
) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === 'take') continue
    if (value) next.set(key, value)
  }
  next.set('take', String(take))
  return `/ledger?${next.toString()}`
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
