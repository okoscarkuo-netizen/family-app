'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'
import { setAccountBalance } from '@/app/actions/accounts'
import { primaryButtonClass, secondaryButtonClass } from '@/components/PageShell'
import { AccountLinkedBalanceFields } from './AccountLinkedBalanceFields'

type Props = {
  account: Pick<FamilyAccount, 'id' | 'name' | 'balance' | 'openingBalance' | 'balanceDate' | 'currency' | 'kind'>
  ledgerDelta: number
  onClose: () => void
}

export function AccountBalanceAdjustModal({ account, ledgerDelta, onClose }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isPairValid, setIsPairValid] = useState(true)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    const input = formRef.current?.querySelector<HTMLInputElement>('input[name="balance"]')
    input?.focus()
    input?.select()
  }, [])

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await setAccountBalance(account.id, formData)
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '調整失敗，請再試一次')
      }
    })
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[1.6rem] border border-[#ece4d8] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="balance-adjust-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-black tracking-[0.18em] text-slate-400">
              隱藏功能
            </p>
            <h2 id="balance-adjust-title" className="mt-1 text-lg font-black text-slate-950">
              期初調整
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              這會直接更新帳戶目前金額與初始金額，對帳差額會自動重算，不會新增交易紀錄。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              onClick={onClose}
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
}
