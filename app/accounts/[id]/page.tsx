import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccountById } from '@/lib/accounts-db'
import { getTransactions } from '@/lib/family-transactions'
import type { FamilyTransaction } from '@/lib/family-transactions'

function AmountLabel({ tx }: { tx: FamilyTransaction }) {
  const colorClass =
    tx.kind === 'income' ? 'text-green-600' : tx.kind === 'expense' ? 'text-red-500' : 'text-blue-500'
  const sign = tx.kind === 'income' ? '+' : tx.kind === 'expense' ? '-' : '⇄'
  return (
    <span className={`text-sm font-black ${colorClass}`}>
      {sign}{tx.amount.toLocaleString('zh-TW')} {tx.currency}
    </span>
  )
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [account, transactions] = await Promise.all([
    getAccountById(decodeURIComponent(id)),
    getTransactions({ accountId: decodeURIComponent(id) }),
  ])

  if (!account) notFound()

  return (
    <main className="min-h-screen bg-[#faf7f0] text-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 rounded-md border-2 border-slate-950 bg-white px-3 py-1.5 text-xs font-black hover:bg-[#fff45f]"
        >
          ← 返回帳戶列表
        </Link>

        {/* Account info card */}
        <div className="mt-4 rounded-lg border-2 border-slate-950 bg-white p-5 shadow-[6px_6px_0_#00c2ff]">
          <h1 className="text-xl font-black">{account.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {[account.type, account.owner, account.currency, account.kind === 'asset' ? '資產' : '負債'].map(tag => (
              <span
                key={tag}
                className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-4 text-3xl font-black">
            {account.balance.toLocaleString('zh-TW')}
            <span className="ml-2 text-base font-semibold text-slate-400">{account.currency}</span>
          </p>
        </div>

        {/* Transaction list */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-black text-slate-600">交易記錄</h2>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">此帳戶還沒有交易記錄</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div
                  key={tx.id}
                  className="rounded-md border-2 border-slate-950 bg-white p-3 shadow-[3px_3px_0_#111827]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-950">
                      {tx.title || tx.merchant || '無標題'}
                    </span>
                    <AmountLabel tx={tx} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {tx.occurred_on} · {tx.category?.name ?? '未分類'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
