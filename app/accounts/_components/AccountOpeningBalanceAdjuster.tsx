'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { FamilyAccount } from '@/lib/finance/types'
import { getDisplayAccountBalance } from '@/lib/finance/types'
import { AccountBalanceAdjustModal } from './AccountBalanceAdjustModal'

const LONG_PRESS_MS = 3000

type Props = {
  account: Pick<FamilyAccount, 'id' | 'name' | 'balance' | 'openingBalance' | 'balanceDate' | 'currency' | 'kind'>
  ledgerDelta: number
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function AccountOpeningBalanceAdjuster({ account, ledgerDelta }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHolding, setIsHolding] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsHolding(false)
  }

  function openAdjuster() {
    clearTimer()
    setIsOpen(true)
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    clearTimer()
    setIsHolding(true)
    timerRef.current = window.setTimeout(openAdjuster, LONG_PRESS_MS)
  }

  function handlePointerEnd() {
    clearTimer()
  }

  function closeAdjuster() {
    clearTimer()
    setIsOpen(false)
  }

  const displayBalance = getDisplayAccountBalance(account)
  const balanceClass = displayBalance < 0 ? 'text-[#c9563f]' : 'text-slate-950'

  if (typeof document === 'undefined') return null

  return (
    <>
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
        className="w-full touch-manipulation select-none text-left"
        aria-label={`長按 3 秒調整 ${account.name} 的目前金額、初始金額與對帳差額`}
      >
        <span className="inline-flex items-end gap-2">
          <span className={`text-[2rem] font-black leading-tight ${balanceClass}`}>
            {fmt(displayBalance)}
          </span>
          <span className="pb-1 text-base font-bold text-slate-400">{account.currency}</span>
        </span>
        {account.balanceDate ? (
          <span className="mt-0.5 block text-[0.68rem] font-bold text-slate-400">
            確認日期 {account.balanceDate}
          </span>
        ) : null}
        <span className="sr-only">長按 3 秒開啟目前金額、初始金額與對帳差額調整</span>
        {isHolding ? (
          <span className="mt-2 block text-[0.68rem] font-bold text-slate-400">
            持續按住中…
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <AccountBalanceAdjustModal
          account={account}
          ledgerDelta={ledgerDelta}
          onClose={closeAdjuster}
        />
      ) : null}
    </>
  )
}
