'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeReminder, deleteReminder, setReminderPaused, updateReminder } from '@/app/actions/reminders'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '@/components/PageShell'
import type { ReminderGroup, ReminderItem } from '@/lib/reminders-db'

const FREQUENCY_LABELS: Record<string, string> = {
  once: '一次',
  weekly: '每週',
  monthly: '每月',
  quarterly: '每三個月',
  semiannual: '每半年',
  yearly: '每年',
}

const FREQUENCY_OPTIONS = [
  { value: 'once', label: '一次' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每三個月' },
  { value: 'semiannual', label: '每半年' },
  { value: 'yearly', label: '每年' },
] as const

const CATEGORY_COLORS: Record<string, string> = {
  車子: 'bg-[#fff3e0] text-[#8b5e00]',
  房屋: 'bg-[#e8f5e9] text-[#2e7d32]',
  帳單: 'bg-[#e3f2fd] text-[#1565c0]',
  家事: 'bg-[#fce4ec] text-[#880e4f]',
  其他: 'bg-[#f3f4f6] text-[#475569]',
}

const CATEGORY_OPTIONS = ['車子', '房屋', '帳單', '家事', '其他'] as const
const CATEGORY_ORDER = [...CATEGORY_OPTIONS]

type ReminderAccountOption = {
  id: string
  name: string
}

function formatMonthDayYear(value: string | null, fallback: string) {
  if (!value) return fallback
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
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
  if (!a.dueOn && !b.dueOn) return a.name.localeCompare(b.name, 'zh-TW')
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
    if (!CATEGORY_ORDER.includes(cat as (typeof CATEGORY_ORDER)[number]) && items.length) {
      result.push({ category: cat, items })
    }
  }

  return result
}

function todayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ReminderEditModal({
  item,
  accountOptions,
  busy,
  onClose,
  onSubmit,
}: {
  item: ReminderItem
  accountOptions: ReminderAccountOption[]
  busy: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[2rem] border border-[#ece4d8] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-edit-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-black tracking-[0.16em] text-[#5b8c79]">保養</p>
            <h2 id="reminder-edit-modal-title" className="mt-1 text-lg font-black text-slate-950">
              編輯保養項目
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e5e7eb] px-3 py-1 text-[0.72rem] font-black text-slate-500 transition hover:bg-slate-50"
          >
            關閉
          </button>
        </div>

        <form key={item.id} onSubmit={onSubmit} className="mt-4 space-y-3">
          <input type="hidden" name="reminder_id" value={item.id} />

          <label className="block">
            <span className="text-xs font-black text-slate-600">名稱 *</span>
            <input
              name="name"
              defaultValue={item.name}
              required
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-black text-slate-600">類別</span>
              <select name="category" defaultValue={item.category ?? ''} className={`mt-1 ${inputClass}`}>
                <option value="">未分類</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black text-slate-600">週期</span>
              <select name="frequency" defaultValue={item.frequency} className={`mt-1 ${inputClass}`}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-black text-slate-600">下次日期</span>
            <input
              name="due_on"
              type="date"
              defaultValue={item.dueOn ?? ''}
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">帳戶</span>
            <select name="account_id" defaultValue={item.accountId ?? ''} className={`mt-1 ${inputClass}`}>
              <option value="">不綁帳戶</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">備註</span>
            <textarea
              name="detail"
              defaultValue={item.detail ?? ''}
              rows={4}
              className={`mt-1 min-h-[6rem] resize-y ${inputClass} text-sm font-medium leading-5`}
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              取消
            </button>
            <button type="submit" disabled={busy} className={`${primaryButtonClass} disabled:opacity-50`}>
              {busy ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

export function ReminderList({
  reminders,
  accountOptions,
}: {
  reminders: ReminderItem[]
  accountOptions: ReminderAccountOption[]
}) {
  const router = useRouter()
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const activeGroups = groupRemindersByCategory(reminders.filter((item) => !item.isPaused))
  const pausedItems = reminders
    .filter((item) => item.isPaused)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
  const editingItem = reminders.find((item) => item.id === editingId) ?? null

  function runAction(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    onSuccess?: () => void,
  ) {
    setPendingKey(key)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          window.alert(result.error ?? '操作失敗，請再試一次。')
          return
        }
        onSuccess?.()
      } catch {
        window.alert('操作失敗，請再試一次。')
      } finally {
        setPendingKey(null)
        router.refresh()
      }
    })
  }

  function handleComplete(reminderId: string) {
    runAction(`complete:${reminderId}`, async () => {
      const data = new FormData()
      data.set('reminder_id', reminderId)
      data.set('completed_on', todayDateString())
      return completeReminder(data)
    })
  }

  function handlePause(reminderId: string, paused: boolean) {
    runAction(`pause:${reminderId}`, async () => {
      const data = new FormData()
      data.set('reminder_id', reminderId)
      data.set('paused', String(paused))
      return setReminderPaused(data)
    })
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const reminderId = String(data.get('reminder_id') ?? '')
    if (!reminderId) return

    runAction(`edit:${reminderId}`, async () => updateReminder(data), () => {
      setEditingId(null)
    })
  }

  function handleDelete(reminderId: string) {
    if (!window.confirm('刪除後，這個保養項目和歷史都會一起移除。要繼續嗎？')) return

    runAction(`delete:${reminderId}`, async () => {
      const data = new FormData()
      data.set('reminder_id', reminderId)
      return deleteReminder(data)
    }, () => {
      if (editingId === reminderId) setEditingId(null)
    })
  }

  if (activeGroups.length === 0 && pausedItems.length === 0) {
    return (
      <div className="mt-8 rounded-[1.5rem] border border-dashed border-[#d6cec0] bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-[1.1rem] font-black text-[#8f959c]">目前沒有保養項目</p>
        <p className="mt-2 text-sm font-semibold text-[#b0b5ba]">
          點「+ 新增」到記一筆建立第一個保養項目
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {activeGroups.length > 0 ? (
          <section className="space-y-5">
            {activeGroups.map((group) => (
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
                    const busyComplete = pendingKey === `complete:${item.id}`
                    const busyPause = pendingKey === `pause:${item.id}`
                    const busyEdit = pendingKey === `edit:${item.id}`
                    const busyDelete = pendingKey === `delete:${item.id}`
                    const busy = busyComplete || busyPause || busyEdit || busyDelete

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
                        <Link
                          href={`/reminders/${encodeURIComponent(item.id)}`}
                          className="flex items-start justify-between gap-3 rounded-xl transition hover:bg-[#fafaf8] active:bg-[#f4f4f2]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.95rem] font-black text-[#202124]">{item.name}</p>
                            <p className="mt-0.5 text-[0.7rem] font-semibold text-[#8f959c]">
                              {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                              {item.accountName ? ` · ${item.accountName}` : ''}
                              {item.detail ? ` · ${item.detail}` : ''}
                            </p>
                            <div className="mt-2 space-y-1 text-[0.72rem] font-semibold text-[#6b7280]">
                              <p>
                                最後一次：
                                <span className="ml-1 font-black text-slate-700">
                                  {formatMonthDayYear(item.lastCompletedOn, '尚未記錄')}
                                </span>
                              </p>
                              <p>
                                下一次：
                                <span className={`ml-1 font-black ${
                                  urgency === 'overdue'
                                    ? 'text-[#d44]'
                                    : urgency === 'soon'
                                      ? 'text-[#c07800]'
                                      : 'text-slate-700'
                                }`}>
                                  {formatMonthDayYear(item.dueOn, '未排程')}
                                </span>
                              </p>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-black ${
                            urgency === 'overdue'
                              ? 'bg-[#fff1f1] text-[#d44]'
                              : urgency === 'soon'
                                ? 'bg-[#fff7e8] text-[#c07800]'
                                : 'bg-[#f3f4f6] text-[#5f6368]'
                          }`}>
                            {urgency === 'overdue' ? '逾期' : urgency === 'soon' ? '快到' : '正常'}
                          </span>
                        </Link>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleComplete(item.id)}
                            disabled={busy}
                            className="rounded-full border border-[#d6e8df] bg-white px-3 py-1.5 text-[0.72rem] font-black text-[#4f8d7c] shadow-sm transition hover:bg-[#edf8f4] active:scale-95 disabled:opacity-50"
                          >
                            {busyComplete ? '處理中…' : '今天完成'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(item.id)}
                            disabled={busy}
                            className="rounded-full border border-[#d7def7] bg-[#f6f8ff] px-3 py-1.5 text-[0.72rem] font-black text-[#4f5fb8] transition active:scale-95 disabled:opacity-50"
                          >
                            {busyEdit ? '處理中…' : '編輯'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePause(item.id, true)}
                            disabled={busy}
                            className="rounded-full border border-[#e9dcc5] bg-[#faf6ef] px-3 py-1.5 text-[0.72rem] font-black text-[#8a6f49] transition active:scale-95 disabled:opacity-50"
                          >
                            {busyPause ? '處理中…' : '暫停'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={busy}
                            className="rounded-full border border-[#f0d3cf] bg-[#fff4f2] px-3 py-1.5 text-[0.72rem] font-black text-[#c9563f] transition active:scale-95 disabled:opacity-50"
                          >
                            {busyDelete ? '處理中…' : '刪除'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[#d6cec0] bg-white px-6 py-8 text-center shadow-sm">
            <p className="text-[1rem] font-black text-[#8f959c]">目前沒有進行中的保養項目</p>
          </div>
        )}

        {pausedItems.length > 0 ? (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-[#eef1f5] px-2.5 py-0.5 text-[0.7rem] font-black text-[#64748b]">
                已暫停
              </span>
              <span className="text-[0.68rem] font-bold text-[#9d9d9d]">{pausedItems.length} 項</span>
            </div>

            <div className="space-y-2">
              {pausedItems.map((item) => {
                const busyPause = pendingKey === `pause:${item.id}`
                const busyEdit = pendingKey === `edit:${item.id}`
                const busyDelete = pendingKey === `delete:${item.id}`
                const busy = busyPause || busyEdit || busyDelete

                return (
                  <div key={item.id} className="rounded-[1.25rem] border border-[#ece8e1] bg-white px-4 py-3 shadow-sm">
                  <Link
                    href={`/reminders/${encodeURIComponent(item.id)}`}
                    className="flex items-start justify-between gap-3 rounded-xl transition hover:bg-[#fafaf8] active:bg-[#f4f4f2]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.95rem] font-black text-[#202124]">{item.name}</p>
                      <p className="mt-0.5 text-[0.7rem] font-semibold text-[#8f959c]">
                        {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                        {item.accountName ? ` · ${item.accountName}` : ''}
                        {item.detail ? ` · ${item.detail}` : ''}
                      </p>
                      <div className="mt-2 space-y-1 text-[0.72rem] font-semibold text-[#6b7280]">
                        <p>
                          最後一次：
                          <span className="ml-1 font-black text-slate-700">
                            {formatMonthDayYear(item.lastCompletedOn, '尚未記錄')}
                          </span>
                        </p>
                        <p>
                          下一次：
                          <span className="ml-1 font-black text-slate-700">
                            {formatMonthDayYear(item.dueOn, '未排程')}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[0.72rem] font-black text-slate-400">已暫停</span>
                  </Link>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        disabled={busy}
                        className="rounded-full border border-[#d7def7] bg-[#f6f8ff] px-3 py-1.5 text-[0.72rem] font-black text-[#4f5fb8] transition active:scale-95 disabled:opacity-50"
                      >
                        {busyEdit ? '處理中…' : '編輯'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePause(item.id, false)}
                        disabled={busy}
                        className="rounded-full border border-[#d6e8df] bg-white px-3 py-1.5 text-[0.72rem] font-black text-[#4f8d7c] shadow-sm transition hover:bg-[#edf8f4] active:scale-95 disabled:opacity-50"
                      >
                        {busyPause ? '處理中…' : '恢復'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={busy}
                        className="rounded-full border border-[#f0d3cf] bg-[#fff4f2] px-3 py-1.5 text-[0.72rem] font-black text-[#c9563f] transition active:scale-95 disabled:opacity-50"
                      >
                        {busyDelete ? '處理中…' : '刪除'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>

      {editingItem ? (
        <ReminderEditModal
          item={editingItem}
          accountOptions={accountOptions}
          busy={pendingKey === `edit:${editingItem.id}`}
          onClose={() => setEditingId(null)}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </>
  )
}
