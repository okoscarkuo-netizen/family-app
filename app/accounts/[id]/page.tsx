import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccountLedgerDelta, getAccounts, getAccountById } from '@/lib/accounts-db'
import { getTransactions } from '@/lib/family-transactions'
import { getDisplayAccountBalance, normalizeOwner } from '@/lib/finance/types'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { BottomNav } from '@/components/BottomNav'
import { AccountMonthNav } from '../_components/AccountMonthNav'
import { AccountEditButton } from '../_components/AccountEditButton'
import { AccountOpeningBalanceAdjuster } from '../_components/AccountOpeningBalanceAdjuster'

function ownerLabel(owner: string | null | undefined): string {
  const normalized = normalizeOwner(owner)
  if (normalized === 'Oscar') return '老公'
  if (normalized === 'Livia') return '老婆'
  return '共用'
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="m15 19-7-7 7-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function parseYear(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseMonth(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : fallback
}

type AccountView = 'all' | 'year' | 'month'

function parseAccountView(value: string | undefined): AccountView {
  if (value === 'all' || value === 'year' || value === 'month') return value
  return 'all'
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPeriodLabel(view: AccountView, year: number, month: number) {
  if (view === 'all') return '全部期間'
  if (view === 'year') return `${year} 年`
  return `${year} 年 ${month} 月`
}



type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string; year?: string; month?: string }>
}

export default async function AccountDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const account = await getAccountById(decodeURIComponent(id))
  if (!account) notFound()

  const now = new Date()
  const view = parseAccountView(query.view)
  const year = parseYear(query.year, now.getFullYear())
  const month = parseMonth(query.month, now.getMonth() + 1)

  const transactionParams =
    view === 'all'
      ? { accountId: account.id }
      : view === 'year'
        ? { accountId: account.id, year }
        : { accountId: account.id, year, month }

  const [allAccounts, transactions, ledgerDelta] = await Promise.all([
    getAccounts(),
    getTransactions(transactionParams),
    getAccountLedgerDelta(account.id),
  ])

  const ledgerAccounts = allAccounts.map((a) => ({ id: a.id, name: a.name }))
  const periodLabel = formatPeriodLabel(view, year, month)

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
            <div className="flex h-[4.5rem] items-start gap-3 px-4 pt-2">
              <Link
                href="/accounts"
                aria-label="返回帳戶"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#202124] transition hover:bg-[#f4f4f2]"
              >
                <BackIcon />
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[1.35rem] font-semibold tracking-normal text-[#202124]">
                  {account.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs font-medium text-[#b5b8bc]">
                    {account.type} · {ownerLabel(account.owner)} · {account.kind === 'liability' ? '負債' : '資產'}
                  </p>
                  {account.favorite ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-[#fff5d8] px-2 py-0.5 text-[0.65rem] font-black text-[#9b6b06]">
                      我的最愛
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="pt-0.5">
                <AccountEditButton account={account} />
              </div>
            </div>
          </header>

          <div className="space-y-3 px-4 pt-4">
            <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
              <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">目前餘額</p>
              <div className="mt-1">
                <AccountOpeningBalanceAdjuster
                  account={{
                    id: account.id,
                    name: account.name,
                    balance: account.balance,
                    openingBalance: account.openingBalance,
                    balanceDate: account.balanceDate,
                    currency: account.currency,
                    kind: account.kind,
                  }}
                  ledgerDelta={ledgerDelta}
                />
                {account.openingBalance != null ? (
                  <p className="mt-1 text-[0.68rem] font-bold text-slate-400">
                    初始金額 {fmt(getDisplayAccountBalance({ balance: account.openingBalance, kind: account.kind }))}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
              <AccountMonthNav accountId={account.id} view={view} year={year} month={month} />
              <p className="mt-2 px-1 text-[0.68rem] font-bold text-slate-400">
                {periodLabel} · {transactions.length.toLocaleString('zh-TW')} 筆
              </p>
            </section>
          </div>

          <div className="mt-2">
            <TransactionList
              transactions={transactions}
              accounts={ledgerAccounts}
              currentAccountId={account.id}
              returnUrl={`/accounts/${encodeURIComponent(account.id)}`}
            />
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
