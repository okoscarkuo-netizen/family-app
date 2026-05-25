'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'
import { accountTypes, accountCurrencies, normalizeOwner } from '@/lib/finance/types'
import { createAccount, updateAccount } from '@/app/actions/accounts'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '@/components/PageShell'

type Props = {
  mode: 'create' | 'edit'
  account?: FamilyAccount
  onClose: () => void
}

const ownerOptions = [
  { value: 'Oscar', label: '老公' },
  { value: 'Livia', label: '老婆' },
  { value: 'shared', label: '共用' },
] as const

export function AccountModal({ mode, account, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createAccount(formData)
        } else {
          await updateAccount(account!.id, formData)
        }
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '發生錯誤，請再試一次')
      }
    })
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[2rem] border border-[#ece4d8] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="account-modal-title" className="text-lg font-black text-slate-950">
          {mode === 'create' ? '新增帳戶' : '編輯帳戶'}
        </h2>

        {error && (
          <p className="mt-2 rounded-md border-2 border-slate-950 bg-[#fff45f] px-3 py-2 text-sm font-bold text-slate-950">
            {error}
          </p>
        )}

        <form action={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-black text-slate-600">名稱 *</span>
            <input
              name="name"
              defaultValue={account?.name ?? ''}
              required
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">類型</span>
            <select name="type" defaultValue={account?.type ?? '現金'} className={`mt-1 ${inputClass}`}>
              {accountTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">歸屬</span>
            <select
              name="owner"
              defaultValue={account?.shared ? 'shared' : normalizeOwner(account?.owner ?? 'Oscar')}
              className={`mt-1 ${inputClass}`}
            >
              {ownerOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          {mode === 'create' && (
            <fieldset>
              <legend className="text-xs font-black text-slate-600">性質</legend>
              <div className="mt-1 flex gap-4">
                {(['asset', 'liability'] as const).map(k => (
                  <label key={k} className="flex items-center gap-1.5 text-sm font-semibold">
                    <input
                      type="radio"
                      name="kind"
                      value={k}
                      defaultChecked={k === 'asset'}
                    />
                    {k === 'asset' ? '資產' : '負債'}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block">
            <span className="text-xs font-black text-slate-600">幣別</span>
            <select name="currency" defaultValue={account?.currency ?? 'TWD'} className={`mt-1 ${inputClass}`}>
              {accountCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="rounded-[1rem] border border-[#efe1bd] bg-[#fffaf0] px-3 py-3">
            <p className="text-xs font-black text-slate-600">顯示設定</p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="favorite"
                  value="true"
                  defaultChecked={account?.favorite ?? false}
                  className="size-4"
                />
                設為我的最愛
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="hidden"
                  value="true"
                  defaultChecked={account?.hidden ?? false}
                  className="size-4"
                />
                隱藏此帳戶
              </label>
            </div>
            <p className="mt-2 text-[0.7rem] font-medium leading-5 text-slate-500">
              我的最愛會固定顯示在帳戶頁最上方。
            </p>
          </div>

          {mode === 'edit' ? (
            <label className="block">
              <span className="text-xs font-black text-slate-600">備注</span>
              <textarea
                name="remark"
                defaultValue={account?.remark ?? ''}
                rows={4}
                className={`mt-1 min-h-[6rem] resize-y ${inputClass} text-sm font-medium leading-5`}
              />
            </label>
          ) : null}

          {mode === 'create' ? (
            <label className="block">
              <span className="text-xs font-black text-slate-600">初始金額</span>
              <input
                name="balance"
                type="number"
                step="0.01"
                defaultValue={0}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          ) : null}

          <div className="mt-5 flex items-center justify-end">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className={secondaryButtonClass}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={`${primaryButtonClass} disabled:opacity-50`}
              >
                {isPending ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
