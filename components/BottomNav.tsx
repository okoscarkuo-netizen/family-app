'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const leftTabs = [
  { href: '/',         icon: '🏠', label: '首頁' },
  { href: '/accounts', icon: '💳', label: '帳戶' },
] as const

const rightTabs = [
  { href: '/ledger',    icon: '📒', label: '流水' },
  { href: '/reminders', icon: '🔔', label: '提醒' },
  { href: '/more',      icon: '⋯', label: '⋯更多' },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const showQuickEntry = pathname !== '/'

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (href === '/accounts') return pathname === href || pathname.startsWith('/accounts/')
    return pathname === href
  }

  function tabClass(active: boolean) {
    return `flex min-h-[3.5rem] items-center justify-center rounded-md px-2 py-4 text-center text-xs font-black ${
      active ? 'bg-[#ff3d9a] text-white' : 'text-slate-700 hover:bg-[#fff45f]'
    }`
  }

  return (
    <nav
      aria-label="底部導航"
      className={`fixed inset-x-0 bottom-0 z-50 grid min-h-[calc(6rem+env(safe-area-inset-bottom))] items-center gap-1 border-t-2 border-slate-950 bg-white/95 px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_0_#00c2ff] backdrop-blur ${
        showQuickEntry ? 'grid-cols-6' : 'grid-cols-5'
      }`}
    >
      {leftTabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-label={tab.label}
          aria-current={isActive(tab.href) ? 'page' : undefined}
          className={tabClass(isActive(tab.href))}
        >
          {tab.label}
        </Link>
      ))}

      {showQuickEntry ? (
        <Link
          href="/ledger/new"
          aria-label="記一筆"
          aria-current={isActive('/ledger/new') ? 'page' : undefined}
          className={tabClass(isActive('/ledger/new'))}
        >
          記一筆
        </Link>
      ) : null}

      {rightTabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-label={tab.label}
          aria-current={isActive(tab.href) ? 'page' : undefined}
          className={tabClass(isActive(tab.href))}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
