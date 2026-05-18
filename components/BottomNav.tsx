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
    <nav aria-label="底部導航" className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-slate-950 bg-[#faf7f0] px-3 py-2">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-2">
        {tabs.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center rounded-xl border-2 border-slate-950 py-2 shadow-[4px_4px_0_#111827] transition-shadow hover:shadow-[6px_6px_0_#111827] ${
                active ? 'bg-white' : 'bg-[#fff45f]'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className={`mt-0.5 text-[10px] ${active ? 'font-black text-slate-950' : 'font-semibold text-slate-950'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
