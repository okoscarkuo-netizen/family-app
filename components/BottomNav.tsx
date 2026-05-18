'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/',          icon: '🏠', label: '首頁' },
  { href: '/accounts',  icon: '💳', label: '帳戶' },
  { href: '/ledger',    icon: '📒', label: '帳本' },
  { href: '/reminders', icon: '🔔', label: '提醒' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav aria-label="底部導航" className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-slate-950 bg-[#fff45f]">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center py-2 transition-colors ${
                active
                  ? 'border-t-[3px] border-slate-950 bg-white'
                  : 'border-t-[3px] border-transparent'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className={`mt-0.5 text-[10px] ${active ? 'font-black text-slate-950' : 'font-semibold text-slate-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
