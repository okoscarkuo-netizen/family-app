import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BottomNav } from '@/components/BottomNav'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { getMaintenanceRecords, getReminderById, type ReminderFrequency } from '@/lib/reminders-db'

function frequencyLabel(value: ReminderFrequency) {
  if (value === 'once') return '一次'
  if (value === 'weekly') return '每週'
  if (value === 'monthly') return '每月'
  if (value === 'quarterly') return '每三個月'
  if (value === 'semiannual') return '每半年'
  return '每年'
}

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ReminderDetailPage({ params }: PageProps) {
  const { id } = await params
  const reminder = await getReminderById(decodeURIComponent(id))
  if (!reminder) notFound()

  const records = await getMaintenanceRecords({ reminderId: reminder.id })

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <div className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
          <div className="flex items-center justify-between pb-3 pt-1">
            <Link href="/reminders" className="text-sm font-black text-slate-500">
              返回
            </Link>
            <span className="rounded-full bg-[#edf8f4] px-3 py-1 text-[0.72rem] font-black text-[#4f8d7c]">
              保養項目
            </span>
          </div>

          <section className="rounded-[1.5rem] border border-[#ece8e1] bg-white px-4 py-4 shadow-sm">
            <p className="text-[0.7rem] font-black tracking-[0.16em] text-[#5b8c79]">{reminder.category ?? '其他'}</p>
            <h1 className="mt-1 text-[1.28rem] font-black text-slate-950">{reminder.name}</h1>
            <p className="mt-1 text-[0.78rem] font-semibold text-slate-500">
              {frequencyLabel(reminder.frequency)}
              {reminder.accountName ? ` · ${reminder.accountName}` : ''}
              {reminder.detail ? ` · ${reminder.detail}` : ''}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[1rem] bg-[#f8fafc] px-3 py-3">
                <p className="text-[0.68rem] font-black tracking-[0.14em] text-slate-400">最後一次</p>
                <p className="mt-1 text-[0.95rem] font-black text-slate-900">
                  {formatDate(reminder.lastCompletedOn, '尚未記錄')}
                </p>
              </div>
              <div className="rounded-[1rem] bg-[#f8fafc] px-3 py-3">
                <p className="text-[0.68rem] font-black tracking-[0.14em] text-slate-400">下一次</p>
                <p className="mt-1 text-[0.95rem] font-black text-slate-900">
                  {formatDate(reminder.dueOn, '未排程')}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[0.78rem] font-semibold text-slate-500">
              共有 {records.length} 筆保養紀錄
            </p>
          </section>

          <section className="mt-4">
            {records.length > 0 ? (
              <TransactionList
                transactions={records}
                accounts={[]}
                returnUrl={`/reminders/${encodeURIComponent(reminder.id)}`}
              />
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[#d6cec0] bg-white px-6 py-10 text-center shadow-sm">
                <p className="text-[1rem] font-black text-[#8f959c]">這個項目還沒有歷史紀錄</p>
                <p className="mt-2 text-sm font-semibold text-[#b0b5ba]">下次完成後，這裡會開始累積每一筆保養。</p>
              </div>
            )}
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
