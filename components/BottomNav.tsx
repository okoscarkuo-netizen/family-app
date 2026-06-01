'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const leftTabs = [
  { href: '/',         label: '首頁' },
  { href: '/accounts', label: '帳戶' },
] as const

const rightTabs = [
  { href: '/ledger',    label: '流水' },
  { href: '/more',      label: '更多' },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const [pendingTargetHref, setPendingTargetHref] = useState<string | null>(null)
  const pendingHref = pendingTargetHref && pathname !== pendingTargetHref ? pendingTargetHref : null
  const quickAddHref = '/ledger/new'
  const quickAddActive = isActive(quickAddHref)
  const quickAddPending = pendingHref === quickAddHref

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (href === '/accounts') return pathname === href || pathname.startsWith('/accounts/')
    if (href === '/ledger') return pathname === href || pathname.startsWith('/ledger/')
    if (href === '/more') return pathname === href || pathname.startsWith('/more/') || pathname === '/reminders' || pathname === '/categories'
    return pathname === href
  }

  function markPending(href: string) {
    setPendingTargetHref(pathname !== href ? href : null)
  }

  function tabClass(active: boolean, pending: boolean) {
    return `flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-black transition ${
      active ? 'text-[#d8a72a]' : pending ? 'text-slate-950' : 'text-slate-500 hover:text-slate-900'
    }`
  }

  function indicatorClass(active: boolean, pending: boolean) {
    if (active) return 'bg-[#d8a72a]'
    if (pending) return 'bg-slate-950 animate-pulse'
    return 'bg-transparent'
  }

  return (
    <nav
      aria-label="底部導航"
      aria-busy={pendingHref ? 'true' : undefined}
      className="fixed inset-x-0 bottom-0 z-50 grid min-h-[calc(6rem+env(safe-area-inset-bottom))] grid-cols-5 items-center gap-1 overflow-visible border-t border-[#eeeeec] bg-white/95 px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-[#d8a72a] transition-opacity ${pendingHref ? 'opacity-100 animate-pulse' : 'opacity-0'}`}
      />
      {leftTabs.map(tab => {
        const active = isActive(tab.href)
        const pending = pendingHref === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => markPending(tab.href)}
            className={tabClass(active, pending)}
          >
            <span>{tab.label}</span>
            <span className={`h-1 w-1 rounded-full transition ${indicatorClass(active, pending)}`} />
          </Link>
        )
      })}

      <Link
        href={quickAddHref}
        aria-label="記一筆"
        aria-current={quickAddActive ? 'page' : undefined}
        onClick={() => markPending(quickAddHref)}
        className={`relative -top-4 flex h-[3.75rem] w-[3.75rem] flex-col items-center justify-center justify-self-center rounded-full text-white shadow-[0_6px_22px_rgba(0,0,0,0.28)] transition active:scale-95 ${
          quickAddPending ? 'scale-[0.96] bg-[#3a3a3a]' : 'bg-[#202124]'
        }`}
      >
        <span className="text-[1.75rem] font-light leading-none">+</span>
        <span className="mt-0.5 text-[0.58rem] font-black tracking-wide">
          {quickAddPending ? '開啟中' : '記一筆'}
        </span>
      </Link>

      {rightTabs.map(tab => {
        const active = isActive(tab.href)
        const pending = pendingHref === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => markPending(tab.href)}
            className={tabClass(active, pending)}
          >
            <span>{tab.label}</span>
            <span className={`h-1 w-1 rounded-full transition ${indicatorClass(active, pending)}`} />
          </Link>
        )
      })}
    </nav>
  )
}
