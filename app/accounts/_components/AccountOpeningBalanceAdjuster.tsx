'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'
import { getDisplayAccountBalance } from '@/lib/finance/types'
import { setAccountBalance } from '@/app/actions/accounts'
import { primaryButtonClass, secondaryButtonClass } from '@/components/PageShell'
import { AccountLinkedBalanceFields } from './AccountLinkedBalanceFields'

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
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isHolding, setIsHolding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isPairValid, setIsPairValid] = useState(true)
  const timerRef = useRef<number | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const input = formRef.current?.querySelector<HTMLInputElement>('input[name="balance"]')
    input?.focus()
    input?.select()
  }, [isOpen])

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsHolding(false)
  }

  function openAdjuster() {
    clearTimer()
    setError(null)
    setIsOpen(true)
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    setError(null)
    clearTimer()
    setIsHolding(true)
    timerRef.current = window.setTimeout(openAdjuster, LONG_PRESS_MS)
  }

  function handlePointerEnd() {
    clearTimer()
  }

  function closeAdjuster() {
    clearTimer()
    setError(null)
    setIsOpen(false)
  }

  function handleSubmit(formData: FormData) {
    setError(null)

    startTransition(async () => {
      try {
        await setAccountBalance(account.id, formData)
        router.refresh()
        setIsOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '調整失敗，請再試一次')
      }
    })
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
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center"
            onClick={closeAdjuster}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-[1.6rem] border border-[#ece4d8] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="opening-balance-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-black tracking-[0.18em] text-slate-400">
                    隱藏功能
                  </p>
                  <h2 id="opening-balance-title" className="mt-1 text-lg font-black text-slate-950">
                    期初調整
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    這會直接更新帳戶目前金額與初始金額，對帳差額會自動重算，不會新增交易紀錄。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAdjuster}
                  className="flex size-9 items-center justify-center rounded-full text-xl font-black text-slate-400 transition hover:bg-[#f6f2eb] hover:text-slate-950"
                  aria-label="關閉"
                >
                  ×
                </button>
              </div>

              {error ? (
                <p className="mt-3 rounded-[0.85rem] bg-[#fff1f1] px-3 py-2 text-sm font-black text-[#c9563f]">
                  {error}
                </p>
              ) : null}

              <form ref={formRef} action={handleSubmit} className="mt-4 space-y-3">
                <AccountLinkedBalanceFields
                  balance={account.balance}
                  openingBalance={account.openingBalance}
                  ledgerDelta={ledgerDelta}
                  balanceDate={account.balanceDate}
                  currentLabel="目前金額"
                  openingLabel="初始金額"
                  reconcileLabel="對帳差額"
                  compact
                  onValidityChange={setIsPairValid}
                />

                <p className="text-xs font-bold text-slate-400">
                  目前帳戶：{account.name} · {account.currency}
                  <br />
                  目前金額、初始金額都可以調整，對帳差額會依交易自動更新。
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeAdjuster}
                    className={secondaryButtonClass}
                    disabled={isPending}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !isPairValid}
                    className={`${primaryButtonClass} disabled:opacity-50`}
                  >
                    {isPending ? '儲存中…' : '套用調整'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )
      ) : null}
    </>
  )
}
