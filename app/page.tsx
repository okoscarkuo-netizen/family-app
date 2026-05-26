import { AssetTrendCard } from '@/app/_components/AssetTrendCard'
import { ExchangeRateCard } from '@/app/_components/ExchangeRateCard'
import { BottomNav } from '@/components/BottomNav'
import { getAccounts } from '@/lib/accounts-db'
import { getNetWorthTrendTransactions } from '@/lib/family-transactions'
import { getTwdRateTable } from '@/lib/exchange-rates'

export default async function HomePage() {
  const [accounts, rateTable, transactions] = await Promise.all([
    getAccounts(),
    getTwdRateTable(),
    getNetWorthTrendTransactions(),
  ])

  return (
    <>
      <main className="min-h-screen bg-[#f4ede3] text-[#1f2328]">
        <div className="absolute inset-x-0 top-0 -z-10 h-[24rem] bg-[radial-gradient(circle_at_top_left,_rgba(199,164,91,0.22),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(31,42,48,0.10),_transparent_34%),linear-gradient(180deg,_#faf5ec_0%,_#f4ede3_100%)]" />

        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6 lg:px-8">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <AssetTrendCard accounts={accounts} transactions={transactions} rateTable={rateTable} />
            <ExchangeRateCard rateTable={rateTable} />
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
