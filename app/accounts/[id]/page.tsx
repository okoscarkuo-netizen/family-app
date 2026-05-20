import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccountById } from '@/lib/accounts-db'
import { getTransactions } from '@/lib/family-transactions'
import type { FamilyTransaction } from '@/lib/family-transactions'
import { BottomNav } from '@/components/BottomNav'
import { PageShell, secondaryButtonClass, surfaceClass, softSurfaceClass } from '@/components/PageShell'

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
  const account = await getAccountById(decodeURIComponent(id))
  if (!account) notFound()

  const transactions = await getTransactions({ accountId: account.id })

  return (
    <PageShell
      title={account.name}
      eyebrow="帳戶明細"
      description={`${account.type} · ${account.owner} · ${account.currency} · ${account.kind === 'asset' ? '資產' : '負債'}`}
      action={
        <Link href="/accounts" className={secondaryButtonClass}>
          ← 返回帳戶列表
        </Link>
      }
      contentClassName="space-y-5"
    >
      <section className={`${surfaceClass} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">目前餘額</p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {account.balance.toLocaleString('zh-TW')}
              <span className="ml-2 text-base font-bold text-slate-400">{account.currency}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[account.type, account.owner, account.currency, account.kind === 'asset' ? '資產' : '負債'].map(tag => (
            <span
              key={tag}
              className="rounded-full border-2 border-slate-950 bg-[#fff45f] px-3 py-1 text-xs font-black text-slate-950"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className={`${surfaceClass} space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-950">交易記錄</h2>
          <span className="rounded-md border-2 border-slate-950 bg-[#e9fbff] px-2.5 py-1 text-xs font-black text-slate-700">
            {transactions.length} 筆
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className={`${softSurfaceClass} border-dashed text-center text-sm font-black text-slate-600`}>
            此帳戶還沒有交易記錄
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => (
              <div key={tx.id} className="rounded-2xl border-2 border-slate-950 bg-[#faf7f0] p-3 shadow-[4px_4px_0_#111827]">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-black text-slate-950">
                    {tx.title || tx.merchant || '無標題'}
                  </span>
                  <AmountLabel tx={tx} />
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {tx.occurred_on} · {tx.categoryPath ?? '未分類'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      <BottomNav />
    </PageShell>
  )
}
