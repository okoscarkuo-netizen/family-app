import { cache, Suspense } from 'react'
import { AssetTrendCard } from '@/app/_components/AssetTrendCard'
import { ExchangeRateCard } from '@/app/_components/ExchangeRateCard'
import { BottomNav } from '@/components/BottomNav'
import { getAccounts } from '@/lib/accounts-db'
import { getNetWorthTrendTransactions } from '@/lib/family-transactions'
import type { FamilyAccount } from '@/lib/finance/types'
import {
  convertToTwd,
  getTwdRateTable,
  type TwdRateSnapshot,
  type TwdRateTable,
} from '@/lib/exchange-rates'

const getHomeAccounts = cache(getAccounts)
const getHomeRateTable = cache(getTwdRateTable)
const getHomeTrendTransactions = cache(getNetWorthTrendTransactions)

function formatCurrency(value: number) {
  return `NT$${new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(value)}`
}

function accountTotal(accounts: FamilyAccount[], kind: FamilyAccount['kind'], snapshot: TwdRateSnapshot) {
  return accounts
    .filter((account) => !account.hidden && account.kind === kind)
    .reduce((sum, account) => sum + convertToTwd(account.balance, account.currency, snapshot), 0)
}

function AssetOverviewCard({
  accounts,
  rateTable,
}: {
  accounts: FamilyAccount[]
  rateTable: TwdRateTable
}) {
  const visibleAccounts = accounts.filter((account) => !account.hidden)
  const assetTotal = accountTotal(visibleAccounts, 'asset', rateTable.latest)
  const liabilityTotal = accountTotal(visibleAccounts, 'liability', rateTable.latest)
  const netAssets = assetTotal - liabilityTotal
  const absNetAssets = Math.abs(netAssets)
  const netAssetsTextClass =
    absNetAssets >= 100_000_000 ? 'text-[2.1rem]' :
    absNetAssets >= 10_000_000  ? 'text-[2.6rem]' :
    absNetAssets >= 1_000_000   ? 'text-[3.4rem]' :
                                  'text-[4.3rem]'

  return (
    <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[0.82rem] font-medium tracking-normal text-slate-500">淨資產</p>
          <div className="grid h-5 w-5 place-items-center rounded-full bg-[#e8f3f8] text-[0.72rem] font-black leading-none text-[#1f7fb4]">
            i
          </div>
        </div>
        <div className="h-5 w-5 rounded-full bg-slate-100 animate-pulse" />
      </div>

      <div className="mt-4">
        <p className={`${netAssetsTextClass} font-normal leading-none tracking-[-0.07em] text-slate-950`}>
          {formatCurrency(netAssets)}
        </p>
        <div className="mt-3">
          <p className="text-[0.78rem] font-medium tracking-normal text-slate-500">較上月底</p>
          <div className="mt-2 h-8 w-44 rounded-full bg-slate-100 animate-pulse" />
        </div>
      </div>

      <div className="mt-4 h-56 w-full rounded-[1.2rem] bg-slate-100 animate-pulse" />

      <div className="mt-4 min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] font-bold text-slate-400">
          <span className="tracking-[0.02em]">總資產</span>
          <span className="text-[0.92rem] text-slate-600">{formatCurrency(assetTotal)}</span>
          <span className="text-slate-300">·</span>
          <span className="tracking-[0.02em]">負債</span>
          <span className="text-[0.92rem] text-slate-600">{formatCurrency(liabilityTotal)}</span>
        </p>
      </div>
    </section>
  )
}

async function AssetTrendWithTransactions({
  accounts,
  rateTable,
}: {
  accounts: FamilyAccount[]
  rateTable: TwdRateTable
}) {
  const transactions = await getHomeTrendTransactions()

  return <AssetTrendCard accounts={accounts} transactions={transactions} rateTable={rateTable} />
}

async function AssetTrendSection() {
  const [accounts, rateTable] = await Promise.all([
    getHomeAccounts(),
    getHomeRateTable(),
  ])

  return (
    <Suspense fallback={<AssetOverviewCard accounts={accounts} rateTable={rateTable} />}>
      <AssetTrendWithTransactions accounts={accounts} rateTable={rateTable} />
    </Suspense>
  )
}

async function ExchangeRateSection() {
  const rateTable = await getHomeRateTable()

  return <ExchangeRateCard rateTable={rateTable} />
}

function AssetTrendCardSkeleton() {
  return (
    <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 w-24 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-5 w-5 rounded-full bg-slate-100 animate-pulse" />
      </div>

      <div className="mt-4">
        <div className="h-16 w-52 rounded-[1.2rem] bg-slate-100 animate-pulse" />
        <div className="mt-4 h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
        <div className="mt-2 h-8 w-44 rounded-full bg-slate-100 animate-pulse" />
      </div>

      <div className="mt-4 h-56 w-full rounded-[1.2rem] bg-slate-100 animate-pulse" />
      <div className="mt-4 h-5 w-full rounded-full bg-slate-100 animate-pulse" />
    </section>
  )
}

function ExchangeRateCardSkeleton() {
  return (
    <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
          <div className="mt-2 h-3 w-32 rounded-full bg-slate-100 animate-pulse" />
        </div>
        <div className="h-7 w-14 rounded-full bg-slate-100 animate-pulse" />
      </div>

      <div className="mt-4 border-b border-[#f1eee9] pb-4">
        <div className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
        <div className="mt-2 h-10 w-40 rounded-[0.9rem] bg-slate-100 animate-pulse" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <>
      <main className="min-h-screen bg-[#f4ede3] text-[#1f2328]">
        <div className="absolute inset-x-0 top-0 -z-10 h-[24rem] bg-[radial-gradient(circle_at_top_left,_rgba(199,164,91,0.22),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(31,42,48,0.10),_transparent_34%),linear-gradient(180deg,_#faf5ec_0%,_#f4ede3_100%)]" />

        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6 lg:px-8">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <Suspense fallback={<AssetTrendCardSkeleton />}>
              <AssetTrendSection />
            </Suspense>
            <Suspense fallback={<ExchangeRateCardSkeleton />}>
              <ExchangeRateSection />
            </Suspense>
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
