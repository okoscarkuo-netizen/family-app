'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'
import type { AccountGroup, FamilyAccount } from '@/lib/finance/types'
import { getAccountGroup, getDisplayAccountBalance, isSharedAccount, normalizeOwner } from '@/lib/finance/types'

type Props = {
  account: FamilyAccount
  ledgerDelta?: number
  onOpen?: (account: FamilyAccount) => void
}

function isAccountHealthy(account: FamilyAccount, ledgerDelta: number | undefined): boolean {
  if (!account.balanceDate || account.openingBalance == null) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(account.balanceDate)
  const diffDays = (today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
  if (diffDays < 0 || diffDays > 30) return false
  const diff = Math.round((account.balance - account.openingBalance - (ledgerDelta ?? 0)) * 100) / 100
  return Math.abs(diff) < 0.005
}

const groupToneMap: Record<AccountGroup, string> = {
  '銀行與活儲': 'border-[#9edfd2] bg-[#effbf8] text-[#13947f]',
  '現金與儲值': 'border-[#f7d88f] bg-[#fff8e7] text-[#9b6b06]',
  '信用卡': 'border-[#a8d3f4] bg-[#f0f8ff] text-[#2478ac]',
  '房貸與負債': 'border-[#f2b4a8] bg-[#fff4f1] text-[#c1543e]',
  '投資': 'border-[#9fc4f5] bg-[#eff6ff] text-[#2e70bb]',
  '實物資產與保險': 'border-[#c7d0da] bg-[#f7f9fb] text-[#526170]',
  '代刷墊與暫付款': 'border-[#c7b7ef] bg-[#f7f2ff] text-[#6d55b7]',
}

const groupIconMap: Record<AccountGroup, string> = {
  '銀行與活儲': '帳',
  '現金與儲值': '$',
  '信用卡': '卡',
  '房貸與負債': '-',
  '投資': '↗',
  '實物資產與保險': '屋',
  '代刷墊與暫付款': '墊',
}

function ownerLabel(account: FamilyAccount) {
  if (isSharedAccount(account)) return '共用'

  const owner = normalizeOwner(account.owner)
  if (owner === 'Oscar') return '老公'
  if (owner === 'Livia') return '老婆'
  return String(owner)
}

function AutoFitAccountName({ name }: { name: string }) {
  const nameRef = useRef<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    const element = nameRef.current
    if (!element) return

    const maxRem = 0.98
    const minRem = 0.56
    const stepRem = 0.02

    const fitText = () => {
      element.style.fontSize = `${maxRem}rem`

      let currentRem = maxRem
      while (element.scrollWidth > element.clientWidth && currentRem > minRem) {
        currentRem = Math.max(minRem, Number((currentRem - stepRem).toFixed(2)))
        element.style.fontSize = `${currentRem}rem`
      }
    }

    fitText()

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(fitText)
    })

    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)

    return () => observer.disconnect()
  }, [name])

  return (
    <span
      ref={nameRef}
      className="block whitespace-nowrap font-black leading-tight text-slate-950"
      style={{ fontSize: '0.98rem' }}
      title={name}
    >
      {name}
    </span>
  )
}

export function AccountCard({ account, ledgerDelta, onOpen }: Props) {
  const displayBalance = getDisplayAccountBalance(account)
  const healthy = isAccountHealthy(account, ledgerDelta)
  const balanceStr = displayBalance.toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const group = getAccountGroup(account)
  const isShared = isSharedAccount(account)
  const isNegative = displayBalance < 0
  const isFavorite = Boolean(account.favorite)

  return (
    <div
      className={`group relative flex min-h-[4.7rem] items-stretch transition active:bg-[#fbfaf7] ${
        account.hidden
          ? 'bg-[#fcfbf8] opacity-75'
          : 'bg-white'
      }`}
    >
      <Link
        href={`/accounts/${encodeURIComponent(account.id)}`}
        onClick={() => onOpen?.(account)}
        className="grid min-w-0 flex-1 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 pr-14"
      >
        <span
          className={`flex size-9 items-center justify-center rounded-[0.75rem] border text-sm font-black ${groupToneMap[group]}`}
          aria-hidden="true"
        >
          {groupIconMap[group]}
        </span>

        <span className="min-w-0">
          <AutoFitAccountName name={account.name} />
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[0.72rem] font-bold text-slate-500">
            <span className="truncate">{account.type}</span>
            <span className="text-slate-300">·</span>
            <span>{ownerLabel(account)}</span>
            {isFavorite ? (
              <span className="rounded-full bg-[#fff5d8] px-2 py-0.5 text-[0.65rem] font-black text-[#9b6b06]">
                我的最愛
              </span>
            ) : null}
            {account.hidden ? (
              <span className="rounded-full bg-[#fff1f1] px-2 py-0.5 text-[0.65rem] font-black text-[#d85d28]">
                隱藏
              </span>
            ) : null}
            {isShared && !account.hidden ? (
              <span className="rounded-full bg-[#ecfdf8] px-2 py-0.5 text-[0.65rem] font-black text-[#15957d]">
                共用
              </span>
            ) : null}
          </span>
        </span>

        <span className="flex min-w-[6.8rem] items-center justify-end gap-2 text-right">
          <span className="min-w-0">
            <span className={`block truncate text-[0.95rem] font-black ${isNegative ? 'text-[#c9563f]' : 'text-slate-700'}`}>
              {balanceStr}
            </span>
            <span className="block text-right text-[0.68rem] font-bold text-slate-400">{account.currency}</span>
          </span>
          <span className="text-xl leading-none text-slate-300">›</span>
          {healthy ? (
            <span
              className="flex size-[1.05rem] shrink-0 items-center justify-center rounded-full bg-[#d6f5e8] text-[0.62rem] font-black text-[#15957d]"
              title="對帳差額為零且確認日期在 30 天內"
              aria-label="帳戶健康"
            >
              ✓
            </span>
          ) : null}
        </span>
      </Link>

    </div>
  )
}
