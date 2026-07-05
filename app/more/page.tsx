import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { getReminders } from '@/lib/reminders-db'

const quickLinks = [
  {
    href: '/categories',
    title: '分類管理',
    description: '新增、修改或封存收支與轉帳分類。',
  },
  {
    href: '/merchants',
    title: '商家管理',
    description: '編輯商家名稱與所屬分類。',
  },
  {
    href: '/recurring',
    title: '定期交易',
    description: '管理已建立的定期規則（暫停 / 編輯 / 刪除）。',
  },
  {
    href: '/more/passkeys',
    title: 'Passkey 管理',
    description: '用指紋或 Face ID 快速登入，管理已註冊的裝置。',
  },
]

export default async function MorePage() {
  let reminderCount = 0

  try {
    const reminders = await getReminders()
    reminderCount = reminders.length
  } catch (error) {
    console.error('[more] load reminders failed', error)
  }

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
            <div className="flex h-[4.5rem] items-center px-5">
              <h1 className="text-[1.35rem] font-semibold tracking-normal text-[#202124]">更多</h1>
            </div>
          </header>

          <div className="space-y-3 px-4 pt-4">
            <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
              <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">設定與管理</p>
              <p className="mt-2 text-sm font-bold text-slate-600">
                把家庭設定、分類與資料管理集中在這裡，先從常用入口開始。
              </p>
            </section>

            <Link
              href="/reminders"
              className="block rounded-[1.35rem] border border-[#dcefe7] bg-[#f5fbf8] px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition hover:bg-[#eef8f2]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.72rem] font-black tracking-[0.16em] text-[#5b8c79]">保養</p>
                  <p className="mt-1 text-[1.02rem] font-black text-slate-950">所有保養項目</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {reminderCount > 0
                      ? `目前有 ${reminderCount} 個保養項目，點進去看全部。`
                      : '集中看全部保養項目、逾期狀態與暫停中的項目。'}
                  </p>
                </div>
                <span aria-hidden="true" className="text-xl leading-none text-[#88b39f]">›</span>
              </div>
            </Link>

            <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white p-2 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
              <p className="px-3 pb-2 pt-2 text-[0.72rem] font-black tracking-[0.16em] text-slate-400">
                常用入口
              </p>
              <div className="divide-y divide-[#f1ede6]">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between gap-3 px-3 py-3 transition hover:bg-[#fbfaf7]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[0.98rem] font-black text-slate-950">
                        {link.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs font-bold text-slate-500">
                        {link.description}
                      </div>
                    </div>
                    <span aria-hidden="true" className="text-xl leading-none text-slate-300">›</span>
                  </Link>
                ))}
              </div>
            </section>

          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
