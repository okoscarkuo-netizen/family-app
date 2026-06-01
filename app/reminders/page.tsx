import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { getReminders } from '@/lib/reminders-db'
import { ReminderList } from '@/app/reminders/_components/ReminderList'

export default async function RemindersPage() {
  const reminders = await getReminders()

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <div className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
          <div className="flex items-center justify-between pb-3 pt-1">
            <h1 className="text-[1.5rem] font-black text-[#202124]">提醒</h1>
            <Link
              href="/ledger/new?kind=reminder"
              className="rounded-full bg-[#202124] px-4 py-2 text-sm font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition hover:bg-[#3c4043] active:scale-95"
            >
              + 新增
            </Link>
          </div>
          <ReminderList reminders={reminders} />
        </div>
      </main>
      <BottomNav />
    </>
  )
}
