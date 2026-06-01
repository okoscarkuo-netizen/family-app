'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeReminder } from '@/app/actions/reminders'
import type { ReminderGroup, ReminderItem } from '@/lib/reminders-db'

const FREQUENCY_LABELS: Record<string, string> = {
  once: '一次',
  weekly: '每週',
  monthly: '每月',
  quarterly: '每季',
  yearly: '每年',
}

const CATEGORY_COLORS: Record<string, string> = {
  車子: 'bg-[#fff3e0] text-[#8b5e00]',
  房屋: 'bg-[#e8f5e9] text-[#2e7d32]',
  帳單: 'bg-[#e3f2fd] text-[#1565c0]',
  家事: 'bg-[#fce4ec] text-[#880e4f]',
  其他: 'bg-[#f3e5f5] text-[#6a1b9a]',
}

const CATEGORY_ORDER = ['車子', '房屋', '帳單', '家事', '其他']

function nextDueOn(frequency: string, from: Date): string {
  const d = new Date(from)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') { d.setDate(1); d.setMonth(d.getMonth() + 1) }
  else if (frequency === 'quarterly') { d.setDate(1); d.setMonth(d.getMonth() + 3) }
  else if (frequency === 'yearly') { d.setDate(1); d.setMonth(d.getMonth() + 12) }
  else return ''
  return d.toISOString().slice(0, 10)
}

function formatDueOn(dueOn: string | null) {
  if (!dueOn) return '未排程'
  const d = new Date(`${dueOn}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dueOn
  const now = new Date()
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000)
  const formatted = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(d)
  if (diffDays < 0) return `逾期 ${-diffDays} 天（${formatted}）`
  if (diffDays === 0) return `今天（${formatted}）`
  if (diffDays <= 7) return `${diffDays} 天後（${formatted}）`
  return formatted
}

function dueUrgency(dueOn: string | null): 'overdue' | 'soon' | 'normal' {
  if (!dueOn) return 'normal'
  const d = new Date(`${dueOn}T12:00:00`)
  if (Number.isNaN(d.getTime())) return 'normal'
  const diffDays = Math.round((d.getTime() - new Date().getTime()) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'soon'
  return 'normal'
}

function compareDueDate(a: ReminderItem, b: ReminderItem) {
  if (!a.dueOn && !b.dueOn) return 0
  if (!a.dueOn) return 1
  if (!b.dueOn) return -1
  return a.dueOn.localeCompare(b.dueOn)
}

function groupRemindersByCategory(reminders: ReminderItem[]): ReminderGroup[] {
  const map = new Map<string, ReminderItem[]>()

  for (const reminder of reminders) {
    const cat = reminder.category ?? '其他'
    const group = map.get(cat) ?? []
    group.push(reminder)
    map.set(cat, group)
  }

  for (const group of map.values()) {
    group.sort(compareDueDate)
  }

  const result: ReminderGroup[] = []
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat)
    if (items?.length) result.push({ category: cat, items })
  }

  for (const [cat, items] of map.entries()) {
    if (!CATEGORY_ORDER.includes(cat) && items.length) {
      result.push({ category: cat, items })
    }
  }

  return result
}

type OptimisticAction = { type: 'complete'; id: string }

export function ReminderList({ reminders }: { reminders: ReminderItem[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [optimisticReminders, applyOptimistic] = useOptimistic(
    reminders,
    (current: ReminderItem[], action: OptimisticAction) => {
      return current.flatMap((item) => {
        if (item.id !== action.id) return [item]
        if (item.frequency === 'once') return []

        const fromDate = item.dueOn ? new Date(`${item.dueOn}T12:00:00`) : new Date()
        return [{ ...item, dueOn: nextDueOn(item.frequency, fromDate) }]
      })
    },
  )
  const groups = groupRemindersByCategory(optimisticReminders)

  function handleComplete(reminderId: string) {
    setBusyId(reminderId)
    startTransition(async () => {
      applyOptimistic({ type: 'complete', id: reminderId })
      const data = new FormData()
      data.set('reminder_id', reminderId)
      try {
        const result = await completeReminder(data)
        if (!result.ok) {
          window.alert(`完成失敗：${result.error}`)
        }
      } catch {
        window.alert('完成失敗，請再試一次。')
      } finally {
        setBusyId(null)
        router.refresh()
      }
    })
  }

  if (groups.length === 0) {
    return (
      <div className="mt-8 rounded-[1.5rem] border border-dashed border-[#d6cec0] bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-[1.1rem] font-black text-[#8f959c]">目前沒有待處理提醒</p>
        <p className="mt-2 text-sm font-semibold text-[#b0b5ba]">
          點「+ 新增」加入你的第一個提醒事項
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.category}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-black ${CATEGORY_COLORS[group.category] ?? 'bg-[#f0ebe1] text-[#6f5e3a]'}`}>
              {group.category}
            </span>
            <span className="text-[0.68rem] font-bold text-[#9d9d9d]">{group.items.length} 項</span>
          </div>

          <div className="space-y-2">
            {group.items.map((item) => {
              const urgency = dueUrgency(item.dueOn)
              return (
                <div
                  key={item.id}
                  className={`rounded-[1.25rem] border bg-white px-4 py-3 shadow-sm ${
                    urgency === 'overdue'
                      ? 'border-[#f9c2c2]'
                      : urgency === 'soon'
                        ? 'border-[#fde8b8]'
                        : 'border-[#ece8e1]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-black text-[#202124]">{item.name}</p>
                      <p className="mt-0.5 text-[0.7rem] font-semibold text-[#8f959c]">
                        {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                        {item.accountName ? ` · ${item.accountName}` : ''}
                        {item.detail ? ` · ${item.detail}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleComplete(item.id)}
                      disabled={busyId === item.id}
                      className="shrink-0 rounded-full border border-[#d6e8df] bg-white px-3 py-1.5 text-[0.72rem] font-black text-[#4f8d7c] shadow-sm transition hover:bg-[#edf8f4] active:scale-95 disabled:opacity-50"
                    >
                      {busyId === item.id ? '處理中…' : '完成'}
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[0.72rem] font-black ${
                      urgency === 'overdue' ? 'text-[#d44]' : urgency === 'soon' ? 'text-[#c07800]' : 'text-[#5f6368]'
                    }`}>
                      {formatDueOn(item.dueOn)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
