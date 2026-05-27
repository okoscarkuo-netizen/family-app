import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { getReminders, groupRemindersByCategory } from '@/lib/reminders-db'
import { ReminderCompleteButton } from '@/app/reminders/_components/ReminderCompleteButton'

const FREQUENCY_LABELS: Record<string, string> = {
  once: '一次',
  weekly: '每週',
  monthly: '每月',
  quarterly: '每季',
  yearly: '每年',
}

const CATEGORY_COLORS: Record<string, string> = {
  車子: 'bg-[#fff3e0] text-[#8b5e00]',
  房屋: 'bg-[#e8f5e9] text-[#2e7d32]',
  帳單: 'bg-[#e3f2fd] text-[#1565c0]',
  家事: 'bg-[#fce4ec] text-[#880e4f]',
  其他: 'bg-[#f3e5f5] text-[#6a1b9a]',
}

function formatDueOn(dueOn: string | null) {
  if (!dueOn) return '未排程'
  const d = new Date(`${dueOn}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dueOn
  const now = new Date()
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000)
  const formatted = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(d)
  if (diffDays < 0) return `逾期 ${-diffDays} 天（${formatted}）`
  if (diffDays === 0) return `今天（${formatted}）`
  if (diffDays <= 7) return `${diffDays} 天後（${formatted}）`
  return formatted
}

function dueUrgency(dueOn: string | null): 'overdue' | 'soon' | 'normal' {
  if (!dueOn) return 'normal'
  const d = new Date(`${dueOn}T12:00:00`)
  if (Number.isNaN(d.getTime())) return 'normal'
  const diffDays = Math.round((d.getTime() - new Date().getTime()) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'soon'
  return 'normal'
}

export default async function RemindersPage() {
  const reminders = await getReminders()
  const groups = groupRemindersByCategory(reminders)

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

          {groups.length === 0 ? (
            <div className="mt-8 rounded-[1.5rem] border border-dashed border-[#d6cec0] bg-white px-6 py-10 text-center shadow-sm">
              <p className="text-[1.1rem] font-black text-[#8f959c]">目前沒有待處理提醒</p>
              <p className="mt-2 text-sm font-semibold text-[#b0b5ba]">
                點「+ 新增」加入你的第一個提醒事項
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.category}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-black ${CATEGORY_COLORS[group.category] ?? 'bg-[#f0ebe1] text-[#6f5e3a]'}`}>
                      {group.category}
                    </span>
                    <span className="text-[0.68rem] font-bold text-[#9d9d9d]">{group.items.length} 項</span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const urgency = dueUrgency(item.dueOn)
                      return (
                        <div
                          key={item.id}
                          className={`rounded-[1.25rem] border bg-white px-4 py-3 shadow-sm ${
                            urgency === 'overdue'
                              ? 'border-[#f9c2c2]'
                              : urgency === 'soon'
                                ? 'border-[#fde8b8]'
                                : 'border-[#ece8e1]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.95rem] font-black text-[#202124]">{item.name}</p>
                              <p className="mt-0.5 text-[0.7rem] font-semibold text-[#8f959c]">
                                {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                                {item.accountName ? ` · ${item.accountName}` : ''}
                                {item.detail ? ` · ${item.detail}` : ''}
                              </p>
                            </div>
                            <ReminderCompleteButton reminderId={item.id} />
                          </div>

                          <div className="mt-2 flex items-center gap-1.5">
                            <span className={`text-[0.72rem] font-black ${
                              urgency === 'overdue' ? 'text-[#d44]' : urgency === 'soon' ? 'text-[#c07800]' : 'text-[#5f6368]'
                            }`}>
                              {formatDueOn(item.dueOn)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
