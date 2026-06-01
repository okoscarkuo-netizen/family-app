'use client'

import Link from 'next/link'
import { useState } from 'react'

type Props = {
  href: string
  shownCount: number
  totalCount: number
}

export function LoadMoreTransactionsLink({ href, shownCount, totalCount }: Props) {
  const [isPending, setIsPending] = useState(false)

  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => setIsPending(true)}
      aria-busy={isPending}
      className={`relative flex min-h-11 items-center justify-center overflow-hidden rounded-full border border-[#e9e9e6] bg-[#fafaf8] px-4 text-[0.82rem] font-black text-[#5f6368] transition active:scale-[0.99] active:bg-[#f4f4f2] ${
        isPending ? 'border-[#202124] bg-white text-[#202124]' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute bottom-0 left-0 h-0.5 bg-[#e4c44a] transition-all duration-300 ${
          isPending ? 'w-full opacity-100' : 'w-0 opacity-0'
        }`}
      />
      {isPending
        ? '載入更多中…'
        : `顯示更多，已顯示 ${shownCount.toLocaleString('zh-TW')} / ${totalCount.toLocaleString('zh-TW')} 筆`}
    </Link>
  )
}
