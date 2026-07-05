'use client'

import { useState, useTransition } from 'react'
import { runBackupNow, updateBackupSchedule } from '@/app/actions/backup'
import type { BackupSchedule } from '@/lib/backup/schedule'

type Props = {
  schedule: BackupSchedule
  nextSendDateYmd: string
  lastSentAt: string | null
  toEmail: string
}

type Feedback =
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | { type: 'info'; text: string }

function formatLastSent(iso: string | null): string {
  if (!iso) return '尚未寄送'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function BackupSettings({ schedule, nextSendDateYmd, lastSentAt, toEmail }: Props) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const handleSwitch = (next: BackupSchedule) => {
    if (next === schedule || pending) return
    startTransition(async () => {
      const result = await updateBackupSchedule(next)
      if (result.ok) {
        setFeedback({
          type: 'success',
          text: `已切換為${next === 'biweekly' ? '每兩週' : '每月'}`,
        })
      } else {
        setFeedback({ type: 'error', text: `切換失敗：${result.error ?? 'unknown'}` })
      }
    })
  }

  const handleRunNow = () => {
    if (pending) return
    setFeedback(null)
    startTransition(async () => {
      const result = await runBackupNow()
      if (!result.ok) {
        setFeedback({ type: 'error', text: `備份失敗：${result.error}` })
        return
      }
      if (result.skipped) {
        setFeedback({ type: 'info', text: '3 分鐘內已備份過，請稍後再試' })
        return
      }
      const mb = (result.sizeBytes / 1024 / 1024).toFixed(2)
      setFeedback({ type: 'success', text: `✅ 已寄出 ${mb} MB（${result.fileName}）` })
    })
  }

  const btnBase = 'flex-1 rounded-2xl border px-4 py-3 text-sm font-bold transition'
  const btnActive =
    'border-[#2f7d3b] bg-[#e8f4ea] text-[#1c5024] shadow-[0_2px_8px_rgba(47,125,59,0.18)]'
  const btnIdle = 'border-[#ece4d8] bg-white text-slate-500 hover:bg-[#fbfaf7]'

  const feedbackColor =
    feedback?.type === 'success'
      ? 'text-[#2f7d3b]'
      : feedback?.type === 'error'
        ? 'text-[#c9563f]'
        : 'text-slate-500'

  return (
    <>
      <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">自動備份頻率</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleSwitch('biweekly')}
            className={`${btnBase} ${schedule === 'biweekly' ? btnActive : btnIdle}`}
          >
            每兩週
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleSwitch('monthly')}
            className={`${btnBase} ${schedule === 'monthly' ? btnActive : btnIdle}`}
          >
            每月
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm font-bold text-slate-700">
          <div className="flex justify-between">
            <span>下次寄送</span>
            <span>{nextSendDateYmd}（週五）</span>
          </div>
          <div className="flex justify-between">
            <span>上次寄送</span>
            <span>{formatLastSent(lastSentAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>寄送到</span>
            <span className="max-w-[60%] truncate">{toEmail}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          disabled={pending}
          onClick={handleRunNow}
          className="w-full rounded-2xl bg-[#2f7d3b] py-3 text-sm font-black text-white shadow-[0_4px_12px_rgba(47,125,59,0.28)] disabled:opacity-60"
        >
          {pending ? '處理中…' : '立即備份（寄出）'}
        </button>
        {feedback ? (
          <p className={`mt-3 text-xs font-bold ${feedbackColor}`}>{feedback.text}</p>
        ) : null}
      </section>

      <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">說明</p>
        <ul className="mt-2 space-y-1 text-xs font-bold text-slate-500">
          <li>• 每兩週 = 從 2026-06-12 起，每隔 14 天的週五</li>
          <li>• 每月 = 每月第一個週五</li>
          <li>• Excel 含全部資料（8 張分頁）</li>
          <li>• 3 分鐘內按多次只會寄一次</li>
        </ul>
      </section>
    </>
  )
}
