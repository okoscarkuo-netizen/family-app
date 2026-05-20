import type { FamilyTransaction, TransactionKind } from '@/lib/family-transactions'
import { deleteTransaction } from '@/app/actions/transactions'
import { softSurfaceClass, surfaceClass } from '@/components/PageShell'

const KIND_COLOR: Record<TransactionKind, string> = {
  expense: 'text-red-500',
  income: 'text-green-600',
  transfer: 'text-blue-500',
}

const KIND_SIGN: Record<TransactionKind, string> = {
  expense: '-',
  income: '+',
  transfer: '⇄',
}

function formatAmount(tx: FamilyTransaction): string {
  const sign = KIND_SIGN[tx.kind]
  const amount = tx.amount.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${sign}${amount} ${tx.currency}`
}

function groupByDate(transactions: FamilyTransaction[]): Array<{ date: string; items: FamilyTransaction[] }> {
  const map = new Map<string, FamilyTransaction[]>()
  for (const tx of transactions) {
    const existing = map.get(tx.occurred_on) ?? []
    map.set(tx.occurred_on, [...existing, tx])
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} ${['日','一','二','三','四','五','六'][d.getDay()]}`
}

type Props = {
  transactions: FamilyTransaction[]
}

export function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className={`${softSurfaceClass} border-dashed text-center text-sm font-black text-slate-500`}>
        本月還沒有記錄，點右上角「＋ 新增」開始記帳
      </div>
    )
  }

  const groups = groupByDate(transactions)

  return (
    <div className="space-y-4">
      {groups.map(({ date, items }) => (
        <div key={date}>
          <div className="mb-1 px-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{formatDate(date)}</div>
          <div className={`${surfaceClass} divide-y divide-slate-100 p-0`}>
            {items.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-black text-slate-950">
                    {tx.merchant || tx.title}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    {tx.categoryPath && <span>{tx.categoryPath}</span>}
                    {tx.owner && <span className="ml-1">· {tx.owner}</span>}
                  </div>
                </div>
                <span className={`text-sm font-semibold ${KIND_COLOR[tx.kind]} shrink-0`}>
                  {formatAmount(tx)}
                </span>
                <form action={deleteTransaction.bind(null, tx.id)}>
                  <button
                    type="submit"
                    className="ml-1 text-xs font-black text-slate-300 hover:text-[#ff3d9a]"
                    title="刪除"
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
