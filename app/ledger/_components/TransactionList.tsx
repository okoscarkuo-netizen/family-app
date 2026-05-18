import type { FamilyTransaction, TransactionKind } from '@/lib/family-transactions'
import { deleteTransaction } from '@/app/actions/transactions'

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
      <div className="text-center py-12 text-gray-400 text-sm">
        本月還沒有記錄，點右上角「＋ 新增」開始記帳
      </div>
    )
  }

  const groups = groupByDate(transactions)

  return (
    <div className="space-y-4">
      {groups.map(({ date, items }) => (
        <div key={date}>
          <div className="text-xs text-gray-400 font-medium px-1 mb-1">{formatDate(date)}</div>
          <div className="bg-white rounded-xl divide-y divide-gray-50 shadow-sm">
            {items.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {tx.merchant || tx.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {tx.category?.name && <span>{tx.category.name}</span>}
                    {tx.owner && <span className="ml-1">· {tx.owner}</span>}
                  </div>
                </div>
                <span className={`text-sm font-semibold ${KIND_COLOR[tx.kind]} shrink-0`}>
                  {formatAmount(tx)}
                </span>
                <form action={deleteTransaction.bind(null, tx.id)}>
                  <button
                    type="submit"
                    className="text-gray-300 hover:text-red-400 text-xs ml-1"
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
