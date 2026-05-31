'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RecurringTransaction } from '@/lib/recurring-db'
import { deleteRecurringTransaction, toggleRecurringTransaction } from '@/app/actions/recurring'

const FREQ_LABELS: Record<string, string> = {
  weekly: '每週',
  monthly: '每月',
  quarterly: '每季',
  yearly: '每年',
}

function formatMoney(amount: number, currency: string) {
  const value = amount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'TWD' ? `NT$${value}` : `${value} ${currency}`
}

export function RecurringList({ items }: { items: RecurringTransaction[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm font-bold text-slate-400">
        還沒有定期交易。<br />在「記一筆」勾選「＋ 週期」即可建立。
      </div>
    )
  }

  function handleToggle(id: string, currentActive: boolean) {
    setBusyId(id)
    startTransition(async () => {
      await toggleRecurringTransaction(id, !currentActive)
      router.refresh()
      setBusyId(null)
    })
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`確定刪除「${name}」？已產生的歷史交易會保留。`)) return
    setBusyId(id)
    startTransition(async () => {
      await deleteRecurringTransaction(id)
      router.refresh()
      setBusyId(null)
    })
  }

  return (
    <div className="space-y-3 p-4">
      {items.map((it) => {
        const isIncome = it.kind === 'income'
        const meta = [
          FREQ_LABELS[it.frequency],
          it.categoryName,
          it.accountName,
        ].filter(Boolean).join(' · ')
        const remaining = it.endType === 'count' && it.endCount
          ? `${it.generatedCount}/${it.endCount} 次`
          : `已記 ${it.generatedCount} 筆`
        return (
          <div
            key={it.id}
            className={`rounded-[1.2rem] border p-4 ${
              it.isActive ? 'border-[#ece4d8] bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[1rem] font-black text-slate-900">{it.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black ${
                      it.isActive ? 'bg-[#e6f5ec] text-[#187d5f]' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {it.isActive ? '啟用中' : '已暫停'}
                  </span>
                </div>
                <div className="mt-1 text-[0.78rem] font-bold text-slate-500">{meta}</div>
              </div>
              <div className={`shrink-0 text-right text-[1rem] font-black ${isIncome ? 'text-[#15957d]' : 'text-slate-900'}`}>
                {isIncome ? '+' : ''}{formatMoney(it.amount, it.currency)}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
              <div className="text-[0.72rem] font-bold text-slate-500">
                下次：<span className="text-slate-900">{it.isActive ? it.nextDueDate : '已暫停'}</span>　·　{remaining}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggle(it.id, it.isActive)}
                  disabled={busyId === it.id}
                  className="rounded-full bg-[#f4f1ea] px-3 py-1 text-[0.7rem] font-black text-slate-700 disabled:opacity-50"
                >
                  {it.isActive ? '暫停' : '啟用'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(it.id, it.name)}
                  disabled={busyId === it.id}
                  className="rounded-full bg-[#fff1ee] px-3 py-1 text-[0.7rem] font-black text-[#c9563f] disabled:opacity-50"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
