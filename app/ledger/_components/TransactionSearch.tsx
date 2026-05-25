'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Props = {
  initialQuery: string
}

export function TransactionSearch({ initialQuery }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const lastPushedRef = useRef(initialQuery)

  useEffect(() => {
    if (value === lastPushedRef.current) return

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('q', value)
      lastPushedRef.current = value
      router.replace(`/ledger?${params.toString()}`)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [value, searchParams, router])

  function exitSearch() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    const next = params.toString()
    router.push(next ? `/ledger?${next}` : '/ledger')
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="flex flex-1 items-center gap-2 rounded-full border border-[#e9e9e6] bg-[#fafaf8] px-3 focus-within:border-[#e4c44a] focus-within:bg-white">
        <span aria-hidden="true" className="text-sm text-[#a0a4a8]">⌕</span>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="搜尋商家、備註、分類"
          className="ios-search-input h-8 min-w-0 flex-1 bg-transparent font-semibold text-[#3a3d42] outline-none placeholder:text-[#a0a4a8]"
          aria-label="搜尋交易"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
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
        className="h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold text-[#6f747a] hover:text-[#3a3d42]"
      >
        取消
      </button>
    </div>
  )
}
