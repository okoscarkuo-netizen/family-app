'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name'>[]
  currentAccountId?: string
}

export function TransactionFilters({ accounts, currentAccountId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSearchPending, setIsSearchPending] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [optimisticAccountId, setOptimisticAccountId] = useOptimistic(
    currentAccountId ?? '',
    (_current: string, nextAccountId: string) => nextAccountId,
  )
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
    startTransition(() => {
      setOptimisticAccountId(value)
      router.push(nextQuery ? `/ledger?${nextQuery}` : '/ledger')
    })
  }

  return (
    <div aria-busy={isPending || isSearchPending} className="relative flex items-center gap-1.5">
      <div
        aria-hidden="true"
        className={`absolute -bottom-1 left-1 h-0.5 rounded-full bg-[#e4c44a] transition-all duration-300 ${
          isPending || isSearchPending ? 'w-[calc(100%-0.5rem)] opacity-100' : 'w-0 opacity-0'
        }`}
      />
      <label className="sr-only" htmlFor="ledger-account">帳戶</label>
      <select
        id="ledger-account"
        value={optimisticAccountId}
        onChange={e => updateAccount(e.target.value)}
        disabled={isPending}
        className="h-8 min-w-0 flex-1 rounded-full border border-[#e9e9e6] bg-[#fafaf8] px-3 text-[11px] font-semibold text-[#6f747a] outline-none transition focus:border-[#202124] focus:bg-white disabled:opacity-60"
      >
        <option value="">全部帳戶</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <Link
        href={searchHref}
        onClick={() => setIsSearchPending(true)}
        aria-label="搜尋交易"
        className={`flex h-8 shrink-0 items-center justify-center rounded-full border border-[#e9e9e6] bg-[#fafaf8] px-3 text-[11px] font-semibold text-[#6f747a] transition hover:border-[#202124] hover:bg-white hover:text-[#202124] ${
          isSearchPending ? 'border-[#202124] bg-white text-[#202124]' : ''
        }`}
      >
        {isSearchPending ? '開啟中…' : '搜尋'}
      </Link>
    </div>
  )
}
