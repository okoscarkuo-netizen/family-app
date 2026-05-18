'use client'

import { useRef, useState } from 'react'
import { createTransaction } from '@/app/actions/transactions'
import type { FamilyCategory } from '@/lib/family-transactions'
import type { FamilyAccount } from '@/lib/finance/types'

type Kind = 'expense' | 'income' | 'transfer'

const KIND_LABELS: Record<Kind, string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
}

const CURRENCIES = ['TWD', 'USD', 'JPY', 'CNY'] as const
const OWNERS = ['共同', '我', '老婆'] as const

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name' | 'currency'>[]
  categories: FamilyCategory[]
}

export function TransactionForm({ accounts, categories }: Props) {
  const [kind, setKind] = useState<Kind>('expense')
  const [pending, setPending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const filteredCategories = categories.filter(c => c.kind === kind)

  async function handleSubmit(formData: FormData) {
    formData.set('kind', kind)
    const selectedCategory = categories.find(c => c.id === String(formData.get('category_id')))
    if (selectedCategory) formData.set('category_name', selectedCategory.name)
    setPending(true)
    try {
      await createTransaction(formData)
    } finally {
      setPending(false)
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      {/* 交易類型切換 */}
      <div className="flex gap-2">
        {(['expense', 'income', 'transfer'] as Kind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              kind === k
                ? k === 'expense'
                  ? 'bg-red-500 text-white'
                  : k === 'income'
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {/* 金額 + 幣別 */}
      <div className="flex gap-2">
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="金額"
          required
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <select name="currency" defaultValue="TWD" className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 分類 */}
      <select
        name="category_id"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      >
        <option value="">選擇分類</option>
        {filteredCategories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* 帳戶（轉帳時顯示來源+目標，其他只顯示一個） */}
      {kind === 'transfer' ? (
        <div className="flex gap-2 items-center">
          <select name="account_id" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">來源帳戶</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="text-gray-400 text-sm">→</span>
          <select name="to_account_id" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">目標帳戶</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      ) : (
        <select name="account_id" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="">選擇帳戶</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}

      {/* 商家 */}
      <input
        name="merchant"
        type="text"
        placeholder="商家（選填）"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />

      {/* 日期 */}
      <input
        name="occurred_on"
        type="date"
        defaultValue={new Date().toISOString().split('T')[0]}
        required
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />

      {/* 持有人 */}
      <select name="owner" defaultValue="共同" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
        {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>

      {/* 備註 */}
      <input
        name="note"
        type="text"
        placeholder="備註（選填）"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
      >
        {pending ? '新增中…' : '新增'}
      </button>
    </form>
  )
}
