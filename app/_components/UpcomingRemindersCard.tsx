import Link from 'next/link'

type ReminderItem = {
  id: string
  name: string
  detail: string | null
  dueOn: string | null
  frequency: string
  accountName: string | null
}

type Props = {
  reminders: ReminderItem[]
}

function frequencyLabel(value: string) {
  if (value === 'once') return '一次'
  if (value === 'weekly') return '每週'
  if (value === 'monthly') return '每月'
  if (value === 'quarterly') return '每季'
  if (value === 'yearly') return '每年'
  return value
}

function formatDueText(reminder: ReminderItem) {
  if (reminder.dueOn) {
    const date = new Date(`${reminder.dueOn}T00:00:00`)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('zh-TW', {
        month: '2-digit',
        day: '2-digit',
      }).format(date)
    }
    return reminder.dueOn
  }
  return '未排程'
}

export function UpcomingRemindersCard({ reminders }: Props) {
  return (
    <Link href="/reminders" className="block">
      <div className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition hover:shadow-[0_14px_34px_rgba(15,23,42,0.09)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">即將到期</p>
            <p className="mt-1 text-[0.92rem] font-black text-[#202124]">保養總覽</p>
          </div>
          <span className="rounded-full border border-[#e9dcc5] bg-[#faf6ef] px-2.5 py-1 text-[0.68rem] font-black text-[#8a6f49]">
            {reminders.length} 項
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {reminders.length ? (
            reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="rounded-[1rem] border border-[#f0e8db] bg-[#fcfbf8] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-800">{reminder.name}</p>
                    <p className="mt-0.5 truncate text-[0.68rem] font-semibold text-slate-400">
                      {reminder.accountName ?? '未關聯帳戶'}
                      {reminder.detail ? ` · ${reminder.detail}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#f2eadf] px-2 py-1 text-[0.66rem] font-black text-[#7f684a]">
                    {formatDueText(reminder)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[0.64rem] font-bold text-slate-400">
                  <span>{frequencyLabel(reminder.frequency)}</span>
                  <span>→ 查看保養</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1rem] border border-dashed border-[#e8dfd1] bg-[#fcfbf8] px-3 py-5 text-center text-sm font-bold text-slate-400">
              目前沒有待處理保養
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
