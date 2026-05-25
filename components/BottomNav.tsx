'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (href === '/accounts') return pathname === href || pathname.startsWith('/accounts/')
    if (href === '/ledger') return pathname === href || pathname.startsWith('/ledger/')
    if (href === '/more') return pathname === href || pathname.startsWith('/more/') || pathname === '/reminders' || pathname === '/categories'
    return pathname === href
  }

  function tabClass(active: boolean) {
    return `flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-black transition ${
      active ? 'text-[#d8a72a]' : 'text-slate-500 hover:text-slate-900'
    }`
  }

  return (
    <nav
      aria-label="底部導航"
      className="fixed inset-x-0 bottom-0 z-50 grid min-h-[calc(6rem+env(safe-area-inset-bottom))] grid-cols-5 items-center gap-1 overflow-visible border-t border-[#eeeeec] bg-white/95 px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      {leftTabs.map(tab => {
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className={tabClass(active)}
          >
            <span>{tab.label}</span>
            <span className={`h-1 w-1 rounded-full transition ${active ? 'bg-[#d8a72a]' : 'bg-transparent'}`} />
          </Link>
        )
      })}

      <Link
        href="/ledger/new"
        aria-label="記一筆"
        aria-current={isActive('/ledger/new') ? 'page' : undefined}
        className="relative -top-4 flex h-[3.75rem] w-[3.75rem] flex-col items-center justify-center justify-self-center rounded-full bg-[#202124] text-white shadow-[0_6px_22px_rgba(0,0,0,0.28)] transition active:scale-95"
      >
        <span className="text-[1.75rem] font-light leading-none">+</span>
        <span className="mt-0.5 text-[0.58rem] font-black tracking-wide">記一筆</span>
      </Link>

      {rightTabs.map(tab => {
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className={tabClass(active)}
          >
            <span>{tab.label}</span>
            <span className={`h-1 w-1 rounded-full transition ${active ? 'bg-[#d8a72a]' : 'bg-transparent'}`} />
          </Link>
        )
      })}
    </nav>
  )
}
