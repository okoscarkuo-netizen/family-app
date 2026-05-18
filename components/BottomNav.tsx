'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const leftTabs = [
  { href: '/',         icon: '🏠', label: '首頁' },
  { href: '/accounts', icon: '💳', label: '帳戶' },
] as const

const rightTabs = [
  { href: '/ledger',    icon: '📒', label: '帳本' },
  { href: '/reminders', icon: '🔔', label: '提醒' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  function tabClass(active: boolean) {
    return `rounded-md px-2 py-2.5 text-center text-xs font-black ${
      active ? 'bg-[#ff3d9a] text-white' : 'text-slate-700 hover:bg-[#fff45f]'
    }`
  }

  return (
    <nav
      aria-label="底部導航"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-center gap-1 border-t-2 border-slate-950 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_0_#00c2ff] backdrop-blur"
    >
      {leftTabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-label={tab.label}
          aria-current={isActive(tab.href) ? 'page' : undefined}
          className={tabClass(isActive(tab.href))}
        >
          {tab.icon} {tab.label}
        </Link>
      ))}

      <Link
        href="/ledger/new"
        className="rounded-md border-2 border-slate-950 bg-[#fff45f] px-2 py-2 text-center text-xs font-black text-slate-950 shadow-[2px_2px_0_#ff3d9a]"
      >
        記一筆
      </Link>

      {rightTabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-label={tab.label}
          aria-current={isActive(tab.href) ? 'page' : undefined}
          className={tabClass(isActive(tab.href))}
        >
          {tab.icon} {tab.label}
        </Link>
      ))}
    </nav>
  )
}
