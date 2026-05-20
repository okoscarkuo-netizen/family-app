import Link from 'next/link'
import type { FamilyTransaction } from '@/lib/family-transactions'

type Props = {
  transactions: FamilyTransaction[]
  month: number
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

export function MonthlySummaryCard({ transactions, month }: Props) {
  const income = transactions.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense
  const savingRatio = income > 0 ? Math.max(0, Math.min((income - expense) / income, 1)) : 0

  return (
    <Link href="/ledger" className="block">
      <div className="rounded-xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_#111827] transition-shadow hover:shadow-[6px_6px_0_#111827]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-slate-700">
          📒 {month}月收支
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border-2 border-slate-950 bg-[#dcfce7] p-2">
            <p className="text-[10px] font-bold text-green-700">收入</p>
            <p className="text-sm font-black text-green-800">+${fmt(income)}</p>
          </div>
          <div className="rounded-lg border-2 border-slate-950 bg-[#fee2e2] p-2">
            <p className="text-[10px] font-bold text-red-700">支出</p>
            <p className="text-sm font-black text-red-800">-${fmt(expense)}</p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          <div
            className="h-full rounded-full bg-[#22c55e] transition-all"
            style={{ width: `${Math.round(savingRatio * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[10px] text-slate-500">結餘 ${fmt(balance)}</p>
          <p className="text-[10px] text-slate-700 opacity-70">→ 查看流水</p>
        </div>
      </div>
    </Link>
  )
}
