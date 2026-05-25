'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react'
import { HomeSyncButton } from '@/app/_components/HomeSyncButton'
import { TransactionFilters } from '@/app/ledger/_components/TransactionFilters'
import { TransactionSearch } from '@/app/ledger/_components/TransactionSearch'
import type { LedgerView } from '@/app/ledger/_lib/period'
import { formatDateKey, shiftLedgerDate } from '@/app/ledger/_lib/period'
import type { FamilyAccount } from '@/lib/finance/types'

type Props = {
  view: LedgerView
  anchorDate: string
  periodTitle: string
  netAmount: number
  recordLabel: string
  accountLabel: string
  isSearchMode: boolean
  queryRaw: string
  accounts: Pick<FamilyAccount, 'id' | 'name'>[]
  currentAccountId?: string
  children: ReactNode
}

const VIEW_LABELS: Record<LedgerView, string> = {
  year: '年',
  month: '月',
  week: '週',
  day: '日',
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
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

function formatCurrency(value: number) {
  const formatted = Math.abs(value).toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return `TWD ${formatted}`
}

function buildLedgerUrl(params: URLSearchParams, view: LedgerView, anchorDate: Date) {
  const next = new URLSearchParams(params.toString())
  next.set('view', view)
  next.set('date', formatDateKey(anchorDate))
  return `/ledger?${next.toString()}`
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('a,button,input,select,textarea,label,[role="button"]'))
}

export function LedgerViewport({
  view,
  anchorDate,
  periodTitle,
  netAmount,
  recordLabel,
  accountLabel,
  isSearchMode,
  queryRaw,
  accounts,
  currentAccountId,
  children,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [menuOpen, setMenuOpen] = useState(false)
  const swipeRef = useRef<{ x: number; y: number; active: boolean; startedOnInteractive: boolean } | null>(null)
  const touchRef = useRef<{ x: number; y: number; active: boolean; startedOnInteractive: boolean } | null>(null)
  const anchor = new Date(`${anchorDate}T12:00:00`)
  const canNavigate = !isSearchMode
  const netTone = netAmount > 0 ? 'text-[#d66f67]' : netAmount < 0 ? 'text-[#22a884]' : 'text-[#5f6368]'
  const netLabel = `${netAmount > 0 ? '+' : netAmount < 0 ? '-' : ''}${formatCurrency(netAmount)}`
  const subtitle = isSearchMode
    ? (queryRaw.trim() ? `關鍵字「${queryRaw.trim()}」 · ${recordLabel}` : `搜尋結果 · ${recordLabel}`)
    : `${accountLabel} · ${recordLabel}`

  function navigate(delta: number) {
    if (!canNavigate) return
    const nextDate = shiftLedgerDate(view, anchor, delta)
    router.push(buildLedgerUrl(searchParams, view, nextDate))
  }

  function setView(nextView: LedgerView) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('q')
    next.set('view', nextView)
    next.set('date', formatDateKey(anchor))
    setMenuOpen(false)
    router.push(`/ledger?${next.toString()}`)
  }

  function goToCurrentPeriod() {
    const now = new Date()
    const next = new URLSearchParams(searchParams.toString())
    next.delete('q')
    next.set('view', view)
    next.set('date', formatDateKey(now))
    setMenuOpen(false)
    router.push(`/ledger?${next.toString()}`)
  }

  function goToSearch() {
    const next = new URLSearchParams(searchParams.toString())
    next.set('q', queryRaw)
    setMenuOpen(false)
    router.push(`/ledger?${next.toString()}`)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    swipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      active: true,
      startedOnInteractive: isInteractiveElement(event.target),
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current
    if (!swipe?.active) return
    swipeRef.current = null
    if (!canNavigate) return
    if (swipe.startedOnInteractive) return

    const dx = event.clientX - swipe.x
    const dy = event.clientY - swipe.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx < 56 || absDx <= absDy * 1.15) return
    navigate(dx < 0 ? 1 : -1)
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (!touch) return
    touchRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: true,
      startedOnInteractive: isInteractiveElement(event.target),
    }
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const swipe = touchRef.current
    if (!swipe?.active) return
    touchRef.current = null
    if (!canNavigate) return
    if (swipe.startedOnInteractive) return

    const touch = event.changedTouches[0]
    if (!touch) return

    const dx = touch.clientX - swipe.x
    const dy = touch.clientY - swipe.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx < 56 || absDx <= absDy * 1.15) return
    navigate(dx < 0 ? 1 : -1)
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
    <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
      <section
        className="mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeRef.current = null
        }}
        onTouchStartCapture={handleTouchStart}
        onTouchEndCapture={handleTouchEnd}
        onTouchCancel={() => {
          touchRef.current = null
        }}
      >
        <header className="border-b border-[#eeeeec] bg-[#f6f4ef] px-4 pb-2 pt-[calc(0.35rem+env(safe-area-inset-top))] text-[#1f2328]">
          <div className="relative overflow-hidden rounded-[1.8rem] border border-[#ebe4d7] bg-[linear-gradient(180deg,#fffdf8_0%,#fbf7ef_100%)] px-3 py-2.5 shadow-[0_16px_44px_rgba(15,23,42,0.10)]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-9 -top-8 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(120,189,171,0.22)_0%,transparent_72%)]" />
              <div className="absolute -bottom-14 -left-8 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(230,193,145,0.20)_0%,transparent_70%)]" />
            </div>

            <div className="relative flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="切換年、月、週、日"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5ddd0] bg-white/80 text-[#202124] shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition hover:bg-white active:scale-95"
              >
                <FilterIcon />
              </button>

              <div className="min-w-0 flex-1 px-1 text-center">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.84rem] font-black tracking-[0.02em] ${netTone} bg-white/75 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]`}
                >
                  <span className="text-[0.62rem] font-black tracking-[0.26em] text-current/55">淨額</span>
                  <span>{netLabel}</span>
                </div>
              </div>

              <div className="shrink-0">
                <HomeSyncButton compact />
              </div>
            </div>

            <div className="relative mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="上一個期間"
                disabled={!canNavigate}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ece6db] bg-white/70 text-[#6f747a] transition hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronIcon direction="left" />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <div className="truncate text-[1.05rem] font-semibold leading-6 tracking-tight text-[#202124]">
                  {isSearchMode ? '搜尋中' : periodTitle}
                </div>
                <div className="mt-1 truncate text-[0.66rem] font-semibold text-[#8f959c]">{subtitle}</div>
              </div>

              <button
                type="button"
                onClick={() => navigate(1)}
                aria-label="下一個期間"
                disabled={!canNavigate}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ece6db] bg-white/70 text-[#6f747a] transition hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronIcon direction="right" />
              </button>
            </div>
          </div>
        </header>

        <div className="border-b border-[#eeeeec] bg-[#fbfaf7] px-4 py-2">
          {isSearchMode ? (
            <TransactionSearch initialQuery={queryRaw} />
          ) : (
            <TransactionFilters accounts={accounts} currentAccountId={currentAccountId} />
          )}
        </div>

        {children}
      </section>

      {menuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[80]" role="presentation">
              <button
                type="button"
                aria-label="關閉選單"
                className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
                onClick={() => setMenuOpen(false)}
              />

              <div
                className="absolute left-1/2 top-[calc(1rem+env(safe-area-inset-top))] w-[min(18.5rem,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-white/70 bg-[#fffdf8] shadow-[0_20px_60px_rgba(15,23,42,0.24)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ledger-view-menu-title"
              >
                <div className="border-b border-[#ece6db] px-4 py-3">
                  <p id="ledger-view-menu-title" className="text-[0.68rem] font-black tracking-[0.28em] text-[#9d8f74]">
                    檢視模式
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#202124]">由上到下選擇年、月、週、日</p>
                </div>

                <div className="flex flex-col gap-2 px-3 py-3">
                  {(Object.keys(VIEW_LABELS) as LedgerView[]).map((item) => {
                    const active = item === view
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setView(item)}
                        className={`flex w-full items-center justify-between rounded-[1.1rem] border px-3 py-3 text-left transition active:scale-[0.99] ${
                          active
                            ? 'border-[#202124] bg-[#202124] text-white'
                            : 'border-[#ece8e1] bg-white text-[#202124] hover:border-[#d6cec0] hover:bg-[#f8f5ef]'
                        }`}
                      >
                        <div className="text-[0.68rem] font-black tracking-[0.22em] opacity-70">{VIEW_LABELS[item]}</div>
                        <div className="text-sm font-semibold">
                          {item === 'year' ? '年' : item === 'month' ? '月' : item === 'week' ? '週' : '日'}檢視
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-[#f0ebe1] px-3 py-3">
                  <button
                    type="button"
                    onClick={goToCurrentPeriod}
                    className="rounded-[1.1rem] border border-[#ece8e1] bg-white px-3 py-3 text-left text-sm font-semibold text-[#202124] transition hover:border-[#d6cec0] hover:bg-[#f8f5ef]"
                  >
                    回到目前
                  </button>
                  <button
                    type="button"
                    onClick={goToSearch}
                    className="rounded-[1.1rem] border border-[#ece8e1] bg-white px-3 py-3 text-left text-sm font-semibold text-[#202124] transition hover:border-[#d6cec0] hover:bg-[#f8f5ef]"
                  >
                    搜尋交易
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  )
}
