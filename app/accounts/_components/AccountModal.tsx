'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'
import { accountTypes, accountOwners, accountCurrencies } from '@/lib/finance/types'
import { createAccount, updateAccount, archiveAccount } from '@/app/actions/accounts'

type Props = {
  mode: 'create' | 'edit'
  account?: FamilyAccount
  onClose: () => void
}

const INPUT_CLASS =
  'mt-1 w-full rounded-md border-2 border-slate-950 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-[#00c2ff]'

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

  function handleArchive() {
    setError(null)
    startTransition(async () => {
      try {
        await archiveAccount(account!.id)
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '封存失敗')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-slate-950 bg-white p-6 shadow-[8px_8px_0_#00c2ff]">
        <h2 className="text-lg font-black">
          {mode === 'create' ? '新增帳戶' : '編輯帳戶'}
        </h2>

        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
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
              className={INPUT_CLASS}
            />
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">類型</span>
            <select name="type" defaultValue={account?.type ?? '現金'} className={INPUT_CLASS}>
              {accountTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">歸屬</span>
            <select name="owner" defaultValue={account?.owner ?? '共同'} className={INPUT_CLASS}>
              {accountOwners.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-xs font-black text-slate-600">性質</legend>
            <div className="mt-1 flex gap-4">
              {(['asset', 'liability'] as const).map(k => (
                <label key={k} className="flex items-center gap-1.5 text-sm font-semibold">
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    defaultChecked={account ? account.kind === k : k === 'asset'}
                  />
                  {k === 'asset' ? '資產' : '負債'}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-black text-slate-600">幣別</span>
            <select name="currency" defaultValue={account?.currency ?? 'TWD'} className={INPUT_CLASS}>
              {accountCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">起始餘額</span>
            <input
              name="balance"
              type="number"
              min="0"
              step="0.01"
              defaultValue={account?.balance ?? 0}
              className={INPUT_CLASS}
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="hidden"
              value="true"
              defaultChecked={account?.hidden ?? false}
              className="size-4"
            />
            隱藏此帳戶
          </label>

          <div className="mt-5 flex items-center justify-between">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isPending}
                className="rounded-md border-2 border-slate-950 bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                封存帳戶
              </button>
            )}
            <div className={`flex gap-2 ${mode === 'edit' ? '' : 'ml-auto'}`}>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-sm font-black hover:bg-[#e9fbff]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md border-2 border-slate-950 bg-[#00c2ff] px-4 py-2 text-sm font-black hover:bg-[#69dbff] disabled:opacity-50"
              >
                {isPending ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
