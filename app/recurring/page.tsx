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
