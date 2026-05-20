'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function ManualSyncButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const pendingSyncRef = useRef(false)
  const clearMessageTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPending && pendingSyncRef.current) {
      pendingSyncRef.current = false
      setMessage('同步完成')

      if (clearMessageTimerRef.current) {
        window.clearTimeout(clearMessageTimerRef.current)
      }

      clearMessageTimerRef.current = window.setTimeout(() => {
        setMessage(null)
        clearMessageTimerRef.current = null
      }, 2400)
    }

    return () => {
      if (clearMessageTimerRef.current) {
        window.clearTimeout(clearMessageTimerRef.current)
      }
    }
  }, [isPending])

  function handleSync() {
    pendingSyncRef.current = true
    setMessage(null)

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        aria-label="手動同步帳戶資料"
        title={isPending ? '同步中…' : '手動同步帳戶資料'}
        className="group inline-flex h-11 items-center gap-2 rounded-full border-2 border-slate-950 bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-[3px_3px_0_#111827] transition hover:-translate-y-0.5 hover:bg-[#e9fbff] disabled:cursor-wait disabled:opacity-60"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 bg-[#fff45f] shadow-[2px_2px_0_#111827]">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        className={`rounded-full border-2 border-slate-950 bg-[#fff45f] px-3 py-1 text-xs font-black text-slate-950 transition ${
          message ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {message ?? '同步完成'}
      </p>
    </div>
  )
}
