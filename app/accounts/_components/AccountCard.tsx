'use client'

import Link from 'next/link'
import type { FamilyAccount } from '@/lib/finance/types'
import { secondaryButtonClass } from '@/components/PageShell'

type Props = {
  account: FamilyAccount
  onOpen?: (account: FamilyAccount) => void
  onEdit: (account: FamilyAccount) => void
}

export function AccountCard({ account, onOpen, onEdit }: Props) {
  const balanceStr = account.balance.toLocaleString('zh-TW', {
    maximumFractionDigits: 2,
  })

  return (
    <div className="rounded-[1.4rem] border border-[#ece4d8] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <Link
        href={`/accounts/${encodeURIComponent(account.id)}`}
        onClick={() => onOpen?.(account)}
        className="block min-w-0"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[1rem] font-black text-slate-950">{account.name}</p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              {account.type} · {account.shared ? '共用' : account.owner}
            </p>
          </div>
          {account.shared ? (
            <span className="shrink-0 rounded-full bg-[#ecfdf8] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#15957d]">
              共用
            </span>
          ) : null}
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-base font-black text-slate-950">
          {balanceStr} <span className="text-xs font-semibold text-slate-400">{account.currency}</span>
        </span>
        <button
          onClick={() => onEdit(account)}
          className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
          type="button"
          aria-label={`編輯 ${account.name}`}
        >
          ✎
        </button>
      </div>
    </div>
  )
}
