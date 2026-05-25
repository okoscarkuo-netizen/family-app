'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name'>[]
  currentAccountId?: string
}

export function TransactionFilters({ accounts, currentAccountId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchHrefParams = new URLSearchParams(searchParams.toString())
  searchHrefParams.set('q', searchHrefParams.get('q') ?? '')
  const searchHref = `/ledger?${searchHrefParams.toString()}`

  function updateAccount(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('accountId', value)
    } else {
      params.delete('accountId')
    }
    const nextQuery = params.toString()
    router.push(nextQuery ? `/ledger?${nextQuery}` : '/ledger')
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="ledger-account">帳戶</label>
      <select
        id="ledger-account"
        value={currentAccountId ?? ''}
        onChange={e => updateAccount(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-full border border-[#e9e9e6] bg-[#fafaf8] px-3 text-[11px] font-semibold text-[#6f747a] outline-none transition focus:border-[#202124] focus:bg-white"
      >
        <option value="">全部帳戶</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <Link
        href={searchHref}
        aria-label="搜尋交易"
        className="flex h-8 shrink-0 items-center justify-center rounded-full border border-[#e9e9e6] bg-[#fafaf8] px-3 text-[11px] font-semibold text-[#6f747a] transition hover:border-[#202124] hover:bg-white hover:text-[#202124]"
      >
        搜尋
      </Link>
    </div>
  )
}
