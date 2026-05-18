import Link from 'next/link'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = { accounts: FamilyAccount[] }

function fmt(n: number) {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

export function NetWorthCard({ accounts }: Props) {
  const visible = accounts.filter(a => !a.hidden)
  const assets = visible.filter(a => a.kind === 'asset').reduce((s, a) => s + a.balance, 0)
  const liabilities = visible.filter(a => a.kind === 'liability').reduce((s, a) => s + a.balance, 0)
  const net = assets - liabilities
  const multiCurrency = accounts.some(a => a.currency !== 'TWD')

  return (
    <Link href="/accounts" className="block">
      <div className="rounded-xl border-2 border-slate-950 bg-[#00c2ff] p-4 shadow-[4px_4px_0_#111827] transition-shadow hover:shadow-[6px_6px_0_#111827]">
        <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-700">
          💰 淨資產
          {multiCurrency && <span className="ml-1 font-semibold normal-case">（多幣別混算）</span>}
        </p>
        <p className={`mb-3 text-2xl font-black ${net < 0 ? 'text-red-600' : 'text-slate-950'}`}>
          ${fmt(net)}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border-2 border-slate-950 bg-white p-2">
            <p className="text-[10px] font-bold text-slate-500">資產</p>
            <p className="text-sm font-black text-slate-950">${fmt(assets)}</p>
          </div>
          <div className="rounded-lg border-2 border-slate-950 bg-white p-2">
            <p className="text-[10px] font-bold text-slate-500">負債</p>
            <p className="text-sm font-black text-slate-950">${fmt(liabilities)}</p>
          </div>
        </div>
        <p className="mt-2 text-right text-[10px] text-slate-700 opacity-70">→ 查看帳戶</p>
      </div>
    </Link>
  )
}
