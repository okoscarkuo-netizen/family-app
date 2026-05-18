'use client'

import Link from 'next/link'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = {
  account: FamilyAccount
  onEdit: (account: FamilyAccount) => void
}

export function AccountCard({ account, onEdit }: Props) {
  const balanceStr = account.balance.toLocaleString('zh-TW', {
    maximumFractionDigits: 2,
  })

  return (
    <div className="flex items-center gap-3 rounded-md border-2 border-slate-950 bg-white p-3 shadow-[3px_3px_0_#111827]">
      <Link href={`/accounts/${encodeURIComponent(account.id)}`} className="min-w-0 flex-1">
        <p className="truncate font-black text-slate-950">{account.name}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          {account.type} · {account.owner}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-black text-slate-950">
          {balanceStr} <span className="text-xs font-semibold text-slate-400">{account.currency}</span>
        </span>
        <button
          onClick={() => onEdit(account)}
          className="rounded-md border-2 border-slate-950 bg-white px-2 py-1 text-xs hover:bg-[#fff45f]"
          type="button"
          aria-label={`編輯 ${account.name}`}
        >
          ✎
        </button>
      </div>
    </div>
  )
}
