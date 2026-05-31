'use client'

import { useState } from 'react'

type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
type EndType = 'forever' | 'count'

const FREQ_LABELS: Record<Frequency, string> = {
  weekly: '每週',
  monthly: '每月',
  quarterly: '每季',
  yearly: '每年',
}

function FieldLabel({ tone, label }: { tone: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />
      <span className="text-[0.78rem] font-black tracking-[0.12em] text-slate-500">{label}</span>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-md">
      <div className="mb-3 px-1">
        <h2 className="text-[1.1rem] font-black text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm font-bold text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function MockTransactionForm() {
  const [recurringOn, setRecurringOn] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [endType, setEndType] = useState<EndType>('forever')
  const [endCount, setEndCount] = useState(12)

  const nextDate = computeNextDate('2026-05-31', frequency)

  return (
    <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.10)]">
      {/* 頂部標題列 */}
      <div className="flex items-center justify-between bg-[#fef9f0] px-5 py-3">
        <button type="button" className="text-sm font-black text-slate-500">取消</button>
        <div className="text-[0.95rem] font-black text-slate-900">記一筆</div>
        <button type="button" className="text-sm font-black text-[#d8a72a]">儲存</button>
      </div>

      {/* 收支切換 */}
      <div className="flex gap-1 bg-[#fef9f0] px-3 pb-3">
        {['支出', '收入', '轉帳'].map((label, idx) => (
          <button
            key={label}
            type="button"
            className={`flex-1 rounded-full py-2 text-sm font-black transition ${
              idx === 0 ? 'bg-slate-900 text-white' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 金額 */}
      <div className="px-5 pb-4 pt-3 text-right">
        <div className="text-[2.4rem] font-black leading-tight tracking-tight text-slate-950">390</div>
        <div className="text-[0.7rem] font-black text-slate-400">TWD</div>
      </div>

      {/* 分類 */}
      <button type="button" className="flex min-h-[2.9rem] w-full items-center justify-between gap-4 px-5 text-left">
        <FieldLabel tone="bg-[#ff78a6]" label="分類" />
        <div className="flex min-w-0 items-center gap-3">
          <div className="truncate text-[1rem] font-black text-slate-900">訂閱 &gt; Netflix</div>
          <span className="text-lg text-slate-300">›</span>
        </div>
      </button>
      <div className="mx-5 h-px bg-[#efebe4]" />

      {/* 帳戶 */}
      <button type="button" className="flex min-h-[2.9rem] w-full items-center justify-between gap-4 px-5 text-left">
        <FieldLabel tone="bg-[#f0b542]" label="帳戶" />
        <div className="flex min-w-0 items-center gap-3">
          <div className="truncate text-[1rem] font-black text-slate-900">玉山活儲</div>
          <span className="text-lg text-slate-300">›</span>
        </div>
      </button>
      <div className="mx-5 h-px bg-[#efebe4]" />

      {/* 日期 */}
      <div className="flex min-h-[2.9rem] items-center justify-between px-5">
        <FieldLabel tone="bg-[#ff8a73]" label="日期" />
        <div className="text-[1rem] font-black text-slate-900">2026/05/31</div>
      </div>
      <div className="mx-5 h-px bg-[#efebe4]" />

      {/* 商家 */}
      <button type="button" className="flex min-h-[2.9rem] w-full items-center justify-between gap-4 px-5 text-left">
        <FieldLabel tone="bg-[#7eb6c7]" label="商家" />
        <div className="flex min-w-0 items-center gap-3">
          <div className="truncate text-[1rem] font-black text-slate-900">Netflix</div>
          <span className="text-lg text-slate-300">›</span>
        </div>
      </button>
      <div className="mx-5 h-px bg-[#efebe4]" />

      {/* 備註 */}
      <div className="flex min-h-[2.9rem] items-center justify-between px-5">
        <FieldLabel tone="bg-[#b69ad9]" label="備註" />
        <span className="text-[1rem] font-black text-slate-400">無</span>
      </div>

      {/* === 週期（隱藏式：未啟用只顯示小標籤，點下去才展開） === */}
      {!recurringOn ? (
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => setRecurringOn(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#d8c4a0] bg-[#fff8ed] px-3 py-1.5 text-[0.78rem] font-black text-[#a37a1c] transition active:bg-[#fdeacf]"
          >
            <span>＋</span>
            <span>週期</span>
          </button>
        </div>
      ) : (
        <div className="border-t border-[#efebe4] bg-[#fff8ed] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔁</span>
              <span className="text-[0.95rem] font-black text-slate-900">週期設定</span>
            </div>
            <button
              type="button"
              onClick={() => setRecurringOn(false)}
              className="rounded-full bg-white px-3 py-1 text-[0.72rem] font-black text-slate-500"
            >
              移除
            </button>
          </div>

          {/* 頻率 */}
          <div className="mb-3">
            <div className="mb-2 text-[0.72rem] font-black tracking-[0.12em] text-slate-500">頻率</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['weekly', 'monthly', 'quarterly', 'yearly'] as Frequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`rounded-full py-2 text-[0.85rem] font-black transition ${
                    frequency === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'
                  }`}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* 結束方式 */}
          <div className="mb-3">
            <div className="mb-2 text-[0.72rem] font-black tracking-[0.12em] text-slate-500">結束方式</div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setEndType('forever')}
                className={`flex w-full items-center justify-between rounded-[1rem] px-4 py-2.5 text-left transition ${
                  endType === 'forever' ? 'bg-white shadow-sm' : 'bg-transparent'
                }`}
              >
                <span className="text-[0.95rem] font-black text-slate-900">一直重複</span>
                <span className={`h-4 w-4 rounded-full border-2 ${
                  endType === 'forever' ? 'border-[#d8a72a] bg-[#d8a72a]' : 'border-slate-300'
                }`} />
              </button>
              <div
                className={`flex items-center justify-between rounded-[1rem] px-4 py-2.5 transition ${
                  endType === 'count' ? 'bg-white shadow-sm' : 'bg-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setEndType('count')}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="text-[0.95rem] font-black text-slate-900">共</span>
                  <input
                    type="number"
                    value={endCount}
                    onChange={(e) => setEndCount(Number(e.target.value))}
                    onFocus={() => setEndType('count')}
                    className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-[0.95rem] font-black text-slate-900 outline-none"
                  />
                  <span className="text-[0.95rem] font-black text-slate-900">次</span>
                </button>
                <span className={`h-4 w-4 rounded-full border-2 ${
                  endType === 'count' ? 'border-[#d8a72a] bg-[#d8a72a]' : 'border-slate-300'
                }`} />
              </div>
            </div>
          </div>

          {/* 預覽 */}
          <div className="rounded-[1rem] bg-white px-4 py-3">
            <div className="text-[0.7rem] font-black tracking-[0.12em] text-slate-400">下次自動產生</div>
            <div className="mt-0.5 text-[0.95rem] font-black text-slate-900">{nextDate}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function MockMorePage() {
  return (
    <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.10)]">
      <div className="border-b border-[#eeeeec] px-5 py-4">
        <h3 className="text-[1.15rem] font-black text-slate-900">更多</h3>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-[1.35rem] border border-[#ece4d8] bg-white p-2">
          <p className="px-3 pb-2 pt-2 text-[0.72rem] font-black tracking-[0.16em] text-slate-400">常用入口</p>
          <div className="divide-y divide-[#f1ede6]">
            {[
              { title: '分類管理', desc: '新增、修改或封存分類。' },
              { title: '商家管理', desc: '編輯商家名稱與所屬分類。' },
              {
                title: '定期交易',
                desc: '管理已建立的定期規則（暫停 / 編輯 / 刪除）。',
                isNew: true,
              },
              { title: 'Passkey 管理', desc: '管理已註冊的裝置。' },
            ].map((link) => (
              <div key={link.title} className="flex items-center justify-between gap-3 px-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.95rem] font-black text-slate-900">{link.title}</span>
                    {link.isNew ? (
                      <span className="rounded-full bg-[#d8a72a] px-2 py-0.5 text-[0.6rem] font-black tracking-wider text-white">
                        新
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[0.72rem] font-bold text-slate-400">{link.desc}</div>
                </div>
                <span className="text-lg text-slate-300">›</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MockRecurringList() {
  const items = [
    {
      name: 'Netflix 訂閱',
      freq: '每月 5 號',
      amount: 'NT$390',
      account: '玉山活儲',
      category: '訂閱',
      next: '2026/06/05',
      done: 8,
      active: true,
    },
    {
      name: 'Oscar 月薪',
      freq: '每月 28 號',
      amount: '+NT$80,000',
      account: '玉山活儲',
      category: '薪資',
      next: '2026/06/28',
      done: 12,
      active: true,
      isIncome: true,
    },
    {
      name: '車貸（共 60 期）',
      freq: '每月 1 號',
      amount: 'NT$12,500',
      account: '玉山活儲',
      category: '貸款',
      next: '2026/06/01',
      done: '15/60',
      active: true,
    },
    {
      name: 'Spotify 家庭方案',
      freq: '每月 14 號',
      amount: 'NT$240',
      account: '玉山活儲',
      category: '訂閱',
      next: '已暫停',
      done: 3,
      active: false,
    },
  ]

  return (
    <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.10)]">
      <div className="border-b border-[#eeeeec] px-5 py-4">
        <h3 className="text-[1.15rem] font-black text-slate-900">定期交易</h3>
        <p className="mt-1 text-[0.75rem] font-bold text-slate-500">管理已建立的定期規則</p>
      </div>
      <div className="space-y-3 p-4">
        {items.map((it) => (
          <div
            key={it.name}
            className={`rounded-[1.2rem] border p-4 transition ${
              it.active ? 'border-[#ece4d8] bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[1rem] font-black text-slate-900">{it.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black ${
                      it.active ? 'bg-[#e6f5ec] text-[#187d5f]' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {it.active ? '啟用中' : '已暫停'}
                  </span>
                </div>
                <div className="mt-1 text-[0.78rem] font-bold text-slate-500">
                  {it.freq} · {it.category} · {it.account}
                </div>
              </div>
              <div className={`text-right text-[1rem] font-black ${it.isIncome ? 'text-[#15957d]' : 'text-slate-900'}`}>
                {it.amount}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
              <div className="text-[0.72rem] font-bold text-slate-500">
                下次：<span className="text-slate-900">{it.next}</span>　·　已記 {it.done} 筆
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="rounded-full bg-[#f4f1ea] px-3 py-1 text-[0.7rem] font-black text-slate-700"
                >
                  {it.active ? '暫停' : '啟用'}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-3 py-1 text-[0.7rem] font-black text-white"
                >
                  編輯
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function computeNextDate(start: string, freq: Frequency): string {
  const [y, m, d] = start.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (freq === 'weekly') date.setDate(date.getDate() + 7)
  else if (freq === 'monthly') date.setMonth(date.getMonth() + 1)
  else if (freq === 'quarterly') date.setMonth(date.getMonth() + 3)
  else date.setFullYear(date.getFullYear() + 1)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

export function RecurringPreview() {
  return (
    <main className="min-h-screen bg-[#f4ede3] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <p className="text-[0.72rem] font-black tracking-[0.2em] text-[#d8a72a]">DESIGN PREVIEW</p>
          <h1 className="mt-2 text-[1.6rem] font-black text-slate-900">定期交易 — 設計預覽</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">這是純視覺 mockup，按鈕點下去看效果即可，無實際功能</p>
        </header>

        <div className="space-y-12">
          <Section
            title="① 記一筆表單（整合週期切換）"
            subtitle="底部「週期」開關點下去會展開頻率、結束方式、預覽下次扣款日"
          >
            <MockTransactionForm />
          </Section>

          <Section title="② 更多頁面新入口" subtitle="「定期交易」放在常用入口，跟分類管理、商家管理並排">
            <MockMorePage />
          </Section>

          <Section title="③ 定期交易管理頁" subtitle="所有已建立的規則一覽，可暫停 / 啟用 / 編輯">
            <MockRecurringList />
          </Section>
        </div>

        <footer className="mt-12 text-center text-[0.72rem] font-bold text-slate-400">
          以上 mockup 採用既有 App 視覺風格，實際元件樣式可能略有微調
        </footer>
      </div>
    </main>
  )
}
