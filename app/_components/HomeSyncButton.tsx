'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncHomeData } from '@/app/actions/home'

type Props = {
  compact?: boolean
}

export function HomeSyncButton({ compact = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const clearMessageTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (clearMessageTimerRef.current) {
        window.clearTimeout(clearMessageTimerRef.current)
      }
    }
  }, [])

  function showMessage(nextMessage: string) {
    setMessage(nextMessage)

    if (clearMessageTimerRef.current) {
      window.clearTimeout(clearMessageTimerRef.current)
    }

    clearMessageTimerRef.current = window.setTimeout(() => {
      setMessage(null)
      clearMessageTimerRef.current = null
    }, 2200)
  }

  function handleSync() {
    setMessage(null)

    startTransition(async () => {
      try {
        await syncHomeData()
        router.refresh()
        showMessage('同步完成')
      } catch {
        showMessage('同步失敗')
      }
    })
  }

  return (
    <div className={compact ? 'flex flex-col items-end gap-0.5' : 'flex flex-col items-end gap-1'}>
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        aria-label="同步所有首頁資料"
        title={isPending ? '同步中…' : '同步所有資料'}
        className={`inline-flex items-center gap-2 rounded-full border border-[#d8e3df] bg-[#f7faf8] px-3 font-semibold text-[#27594e] shadow-[0_6px_16px_rgba(15,23,42,0.05)] transition hover:bg-white disabled:cursor-wait disabled:opacity-60 ${
          compact ? 'h-9 text-[0.76rem]' : 'h-10 text-[0.82rem]'
        }`}
      >
        <span
          className={`inline-flex items-center justify-center rounded-full bg-white text-[#178369] shadow-[inset_0_0_0_1px_#d8efe7] ${
            compact ? 'h-[18px] w-[18px]' : 'h-5 w-5'
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 0 1-15.36 6.36" />
            <path d="M3 12A9 9 0 0 1 18.36 5.64" />
            <path d="M3 16v-4h4" />
            <path d="M21 8v4h-4" />
          </svg>
        </span>
        <span>{isPending ? '同步中' : '同步'}</span>
      </button>

      <p
        aria-live="polite"
        className={`text-right font-semibold text-[#178369] transition ${
          compact ? 'text-[0.66rem]' : 'text-[0.72rem]'
        } ${message ? 'opacity-100' : 'opacity-0'}`}
      >
        {message ?? '同步完成'}
      </p>
    </div>
  )
}
