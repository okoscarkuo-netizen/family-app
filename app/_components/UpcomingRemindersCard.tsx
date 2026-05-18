import Link from 'next/link'

export function UpcomingRemindersCard() {
  return (
    <Link href="/reminders" className="block">
      <div className="rounded-xl border-2 border-slate-950 bg-[#fff45f] p-4 shadow-[4px_4px_0_#111827] transition-shadow hover:shadow-[6px_6px_0_#111827]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-slate-700">
          🔔 即將到期
        </p>
        <p className="py-4 text-center text-sm text-slate-500">尚無待辦提醒</p>
        <p className="text-right text-[10px] text-slate-700 opacity-70">→ 查看提醒</p>
      </div>
    </Link>
  )
}
