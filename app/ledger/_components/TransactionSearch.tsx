'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

type Props = {
  initialQuery: string
}

export function TransactionSearch({ initialQuery }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const [committedQuery, setCommittedQuery] = useState(initialQuery)
  const [isPending, startTransition] = useTransition()
  const isDebouncing = value !== committedQuery
  const isSearching = isDebouncing || isPending

  useEffect(() => {
    if (value === committedQuery) return

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('q', value)
      setCommittedQuery(value)
      startTransition(() => {
        router.replace(`/ledger?${params.toString()}`)
      })
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [committedQuery, value, searchParams, router, startTransition])

  function updateValue(nextValue: string) {
    setValue(nextValue)
  }

  function exitSearch() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    const next = params.toString()
    startTransition(() => {
      router.push(next ? `/ledger?${next}` : '/ledger')
    })
  }

  return (
    <div aria-busy={isSearching} className="relative flex items-center gap-1.5">
      <div
        aria-hidden="true"
        className={`absolute -bottom-1 left-1 h-0.5 rounded-full bg-[#e4c44a] transition-all duration-300 ${
          isSearching ? 'w-[calc(100%-0.5rem)] opacity-100' : 'w-0 opacity-0'
        }`}
      />
      <label className="flex flex-1 items-center gap-2 rounded-full border border-[#e9e9e6] bg-[#fafaf8] px-3 focus-within:border-[#e4c44a] focus-within:bg-white">
        <span aria-hidden="true" className="text-sm text-[#a0a4a8]">⌕</span>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          placeholder="搜尋商家、備註、分類"
          className="ios-search-input h-8 min-w-0 flex-1 bg-transparent font-semibold text-[#3a3d42] outline-none placeholder:text-[#a0a4a8]"
          aria-label="搜尋交易"
        />
        {value ? (
          <button
            type="button"
            onClick={() => updateValue('')}
            aria-label="清除"
            className="flex h-6 w-6 items-center justify-center rounded-full text-base text-[#a0a4a8] hover:bg-[#eeebe4] hover:text-[#3a3d42]"
          >
            ×
          </button>
        ) : null}
      </label>
      <button
        type="button"
        onClick={exitSearch}
        disabled={isPending}
        className="h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold text-[#6f747a] hover:text-[#3a3d42] disabled:opacity-50"
      >
        {isPending ? '離開中…' : '取消'}
      </button>
    </div>
  )
}
