'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name'>[]
  currentYear: number
  currentMonth: number
}

export function TransactionFilters({ accounts, currentYear, currentMonth }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/ledger?${params.toString()}`)
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="flex gap-2 items-center">
      <select
        value={String(currentYear)}
        onChange={e => updateParam('year', e.target.value)}
        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
      >
        {years.map(y => <option key={y} value={String(y)}>{y} 年</option>)}
      </select>
      <select
        value={String(currentMonth)}
        onChange={e => updateParam('month', e.target.value)}
        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
      >
        {months.map(m => <option key={m} value={String(m)}>{m} 月</option>)}
      </select>
      <select
        value={searchParams.get('accountId') ?? ''}
        onChange={e => updateParam('accountId', e.target.value)}
        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
      >
        <option value="">全部帳戶</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  )
}
