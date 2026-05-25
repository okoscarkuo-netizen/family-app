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
      <div className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition hover:shadow-[0_14px_34px_rgba(15,23,42,0.09)]">
        <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">{month}月收支</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[0.95rem] bg-[#f2fffb] px-3 py-2.5">
            <p className="text-[0.68rem] font-black text-[#15957d]">收入</p>
            <p className="mt-0.5 text-sm font-black text-slate-700">+NT${fmt(income)}</p>
          </div>
          <div className="rounded-[0.95rem] bg-[#fef9f0] px-3 py-2.5">
            <p className="text-[0.68rem] font-black text-[#d18c11]">支出</p>
            <p className="mt-0.5 text-sm font-black text-slate-700">-NT${fmt(expense)}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f0ebe3]">
          <div
            className="h-full rounded-full bg-[#17b79c] transition-all"
            style={{ width: `${Math.round(savingRatio * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[0.68rem] font-bold text-slate-400">結餘 NT${fmt(balance)}</p>
          <p className="text-[0.68rem] font-bold text-slate-400">→ 查看流水</p>
        </div>
      </div>
    </Link>
  )
}
