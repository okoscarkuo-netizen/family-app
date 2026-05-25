import { AssetTrendCard } from '@/app/_components/AssetTrendCard'
import { ExchangeRateCard } from '@/app/_components/ExchangeRateCard'
import { HomeSyncButton } from '@/app/_components/HomeSyncButton'
import { BottomNav } from '@/components/BottomNav'
import { getAccounts } from '@/lib/accounts-db'
import { getNetWorthTrendTransactions } from '@/lib/family-transactions'
import { getTwdRateTable } from '@/lib/exchange-rates'

function formatTodayLabel() {
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'America/Phoenix',
  })
  return formatter.format(new Date())
}

export default async function HomePage() {
  const todayLabel = formatTodayLabel()
  const [accounts, rateTable, transactions] = await Promise.all([
    getAccounts(),
    getTwdRateTable(),
    getNetWorthTrendTransactions(),
  ])

  return (
    <>
      <main className="min-h-screen bg-[#f4ede3] text-[#1f2328]">
        <div className="absolute inset-x-0 top-0 -z-10 h-[24rem] bg-[radial-gradient(circle_at_top_left,_rgba(199,164,91,0.22),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(31,42,48,0.10),_transparent_34%),linear-gradient(180deg,_#faf5ec_0%,_#f4ede3_100%)]" />

        <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-4 sm:px-6 lg:px-8">
          <section className="rounded-[2rem] border border-[#e4d7c4] bg-white/92 px-5 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-black tracking-[0.24em] text-[#917752]">家庭中控</p>
                <h1 className="mt-2 text-[2rem] font-black leading-[0.98] tracking-[-0.05em] text-[#101820] sm:text-[2.6rem]">
                  只看走勢與匯率。
                </h1>
                <p className="mt-2 text-xs font-semibold tracking-wide text-[#8a7860]">{todayLabel}</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  這個首頁只保留最重要的兩個資訊區塊，避免被過多內容干擾。需要時再往下進入流水、帳戶與提醒。
                </p>
              </div>

              <div className="shrink-0">
                <HomeSyncButton compact />
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <AssetTrendCard accounts={accounts} transactions={transactions} rateTable={rateTable} />
            <ExchangeRateCard rateTable={rateTable} />
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
