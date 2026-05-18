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
    <main className="min-h-screen bg-[#faf7f0] pb-28">
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
