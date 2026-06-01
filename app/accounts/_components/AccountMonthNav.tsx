'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'

type AccountView = 'all' | 'year' | 'month'

type Props = {
  accountId: string
  view: AccountView
  year: number
  month: number
}

type PendingIntent = 'prev' | 'next' | 'current' | 'view' | null

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M5.5 6.5h13l-5 5.9v4.2l-3 1.4v-5.6l-5-5.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path d="M9 9.25h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d={direction === 'left' ? 'm15 19-7-7 7-7' : 'm9 5 7 7-7 7'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function buildAccountUrl(accountId: string, params: URLSearchParams, view: AccountView, year: number, month: number) {
  const next = new URLSearchParams(params.toString())
  next.set('view', view)

  if (view === 'all') {
    next.delete('year')
    next.delete('month')
  } else if (view === 'year') {
    next.set('year', String(year))
    next.delete('month')
  } else {
    next.set('year', String(year))
    next.set('month', String(month))
  }

  return `/accounts/${encodeURIComponent(accountId)}?${next.toString()}`
}

function titleForView(view: AccountView, year: number, month: number) {
  if (view === 'all') return '全部'
  if (view === 'year') return `${year}年`
  return `${year}年${month}月`
}

export function AccountMonthNav({ accountId, view, year, month }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const now = new Date()
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingIntent, setPendingIntent] = useState<PendingIntent>(null)
  const [isPending, startTransition] = useTransition()
  const isNavigating = isPending && pendingIntent !== null
  const canNavigate = view !== 'all' && !isNavigating
  const isCurrentYear = view === 'year' && year === now.getFullYear()
  const isCurrentMonth = view === 'month' && year === now.getFullYear() && month === now.getMonth() + 1
  const title = titleForView(view, year, month)

  function pushView(nextView: AccountView, nextYear = year, nextMonth = month, intent: PendingIntent = 'view') {
    setMenuOpen(false)
    setPendingIntent(intent)
    startTransition(() => {
      router.push(buildAccountUrl(accountId, searchParams, nextView, nextYear, nextMonth))
    })
  }

  function go(delta: number) {
    if (view === 'all') return

    if (view === 'year') {
      pushView('year', year + delta, month, delta < 0 ? 'prev' : 'next')
      return
    }

    let nextMonth = month + delta
    let nextYear = year
    if (nextMonth < 1) {
      nextMonth = 12
      nextYear -= 1
    } else if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    pushView('month', nextYear, nextMonth, delta < 0 ? 'prev' : 'next')
  }

  function goCurrent() {
    if (view === 'all') return

    if (view === 'year') {
      pushView('year', now.getFullYear(), month, 'current')
      return
    }

    pushView('month', now.getFullYear(), now.getMonth() + 1, 'current')
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <div aria-busy={isNavigating} className="relative flex items-center gap-2">
        <div
          aria-hidden="true"
          className={`absolute -bottom-1 left-11 h-0.5 rounded-full bg-[#e4c44a] transition-all duration-300 ${
            isNavigating ? 'w-[calc(100%-2.75rem)] opacity-100' : 'w-0 opacity-0'
          }`}
        />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="切換全部、年、月檢視"
          disabled={isNavigating}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e9e9e6] bg-[#fafaf8] text-[#6f747a] transition hover:border-[#d8c7b0] hover:bg-white hover:text-[#202124] active:scale-95 disabled:opacity-50"
        >
          <FilterIcon />
        </button>

        <div className="flex flex-1 items-center overflow-hidden rounded-full border border-[#e9e9e6] bg-[#fafaf8]">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={view === 'year' ? '上一年' : '上個月'}
            disabled={!canNavigate}
            className={`flex h-9 w-9 shrink-0 items-center justify-center text-base font-bold text-[#6f747a] transition hover:bg-[#eeebe4] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
              isNavigating && pendingIntent === 'prev' ? 'scale-95 bg-[#eeebe4] text-[#202124]' : ''
            }`}
          >
            <ChevronIcon direction="left" />
          </button>

          {canNavigate ? (
            <button
              type="button"
              onClick={goCurrent}
              disabled={isNavigating}
              title={isCurrentYear || isCurrentMonth ? '目前在當前檢視' : '點擊回到目前'}
              className={`flex-1 text-center text-xs font-semibold transition disabled:opacity-60 ${
                isCurrentYear || isCurrentMonth ? 'text-[#3a3d42]' : 'text-[#6f747a] hover:text-[#3a3d42]'
              }`}
            >
              {title}
              {(isCurrentYear || isCurrentMonth) && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#e4c44a] align-middle" />
              )}
            </button>
          ) : (
            <div className="flex-1 text-center text-xs font-semibold text-[#3a3d42]">{title}</div>
          )}

          <button
            type="button"
            onClick={() => go(1)}
            aria-label={view === 'year' ? '下一年' : '下個月'}
            disabled={!canNavigate}
            className={`flex h-9 w-9 shrink-0 items-center justify-center text-base font-bold text-[#6f747a] transition hover:bg-[#eeebe4] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
              isNavigating && pendingIntent === 'next' ? 'scale-95 bg-[#eeebe4] text-[#202124]' : ''
            }`}
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      </div>

      {menuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[80]" role="presentation">
              <button
                type="button"
                aria-label="關閉檢視選單"
                className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
                onClick={() => setMenuOpen(false)}
              />

              <div
                className="absolute left-1/2 top-[calc(1rem+env(safe-area-inset-top))] w-[min(18.5rem,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-white/70 bg-[#fffdf8] shadow-[0_20px_60px_rgba(15,23,42,0.24)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-view-menu-title"
              >
                <div className="border-b border-[#ece6db] px-4 py-3">
                  <p id="account-view-menu-title" className="text-[0.68rem] font-black tracking-[0.28em] text-[#9d8f74]">
                    檢視模式
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#202124]">選擇全部、年顯示或月顯示</p>
                </div>

                <div className="flex flex-col gap-2 px-3 py-3">
                  {[
                    { value: 'all' as const, label: '全部顯示' },
                    { value: 'year' as const, label: '年顯示' },
                    { value: 'month' as const, label: '月顯示' },
                  ].map((item) => {
                    const active = item.value === view

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => pushView(item.value)}
                        disabled={isNavigating}
                        className={`flex w-full items-center justify-between rounded-[1.1rem] border px-3 py-3 text-left transition active:scale-[0.99] ${
                          active
                            ? 'border-[#202124] bg-[#202124] text-white'
                            : 'border-[#ece8e1] bg-white text-[#202124] hover:border-[#d6cec0] hover:bg-[#f8f5ef]'
                        }`}
                      >
                        <div className="text-[0.68rem] font-black tracking-[0.22em] opacity-70">{item.label}</div>
                        <div className="text-sm font-semibold">切換</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
