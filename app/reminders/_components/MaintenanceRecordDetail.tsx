'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { deleteMaintenanceRecord, updateMaintenanceRecord } from '@/app/actions/reminders'
import { primaryButtonClass } from '@/components/PageShell'
import type { MaintenanceRecord } from '@/lib/reminders-db'

type Props = {
  record: MaintenanceRecord
  returnUrl: string
}

type Draft = {
  completedOn: string
  note: string
}

type SaveField = 'completed_on' | 'note'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

function formatDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  return `${dateStr} (週${WEEKDAYS[date.getDay()]})`
}

function frequencyLabel(value: MaintenanceRecord['frequency']) {
  if (value === 'once') return '一次'
  if (value === 'weekly') return '每週'
  if (value === 'monthly') return '每月'
  if (value === 'quarterly') return '每三個月'
  if (value === 'semiannual') return '每半年'
  return '每年'
}

export function MaintenanceRecordDetail({ record, returnUrl }: Props) {
  const router = useRouter()
  const initialDraft: Draft = {
    completedOn: record.completedOn,
    note: record.note ?? '',
  }
  const savedDraftRef = useRef(initialDraft)
  const saveSeqRef = useRef(0)
  const [completedOn, setCompletedOn] = useState(initialDraft.completedOn)
  const [note, setNote] = useState(initialDraft.note)
  const [pendingField, setPendingField] = useState<SaveField | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  function currentDraft(overrides: Partial<Draft> = {}): Draft {
    return {
      completedOn,
      note,
      ...overrides,
    }
  }

  async function save(overrides: Partial<Draft>, field: SaveField) {
    const nextDraft = currentDraft(overrides)
    const seq = saveSeqRef.current + 1
    saveSeqRef.current = seq
    setPendingField(field)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.set('completed_on', nextDraft.completedOn)
      formData.set('note', nextDraft.note)
      const result = await updateMaintenanceRecord(record.id, formData)
      if (seq !== saveSeqRef.current) return
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        return
      }
      savedDraftRef.current = nextDraft
      setMessage({ tone: 'success', text: '已儲存' })
      router.refresh()
    } catch (error) {
      if (seq !== saveSeqRef.current) return
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '儲存失敗，請稍後再試。',
      })
    } finally {
      if (seq === saveSeqRef.current) setPendingField(null)
    }
  }

  function handleDateBlur() {
    if (completedOn === savedDraftRef.current.completedOn) return
    void save({ completedOn }, 'completed_on')
  }

  function handleNoteBlur() {
    if (note === savedDraftRef.current.note) return
    void save({ note }, 'note')
  }

  async function handleDelete() {
    if (deleting) return
    if (!window.confirm('確定要刪除這筆保養紀錄嗎？')) return

    setDeleting(true)
    setMessage(null)
    try {
      const result = await deleteMaintenanceRecord(record.id)
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        setDeleting(false)
        return
      }
      router.push(returnUrl)
      router.refresh()
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '刪除失敗，請稍後再試。',
      })
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#efefed] text-[#202124]">
      <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-[calc(7.5rem+env(safe-area-inset-bottom))] shadow-[0_0_40px_rgba(15,23,42,0.08)]">
        <header className="bg-[#666664] px-5 pb-5 pt-[calc(1rem+env(safe-area-inset-top))]">
          <Link
            href={returnUrl}
            className="inline-flex h-12 min-w-12 items-center justify-center rounded-full bg-white/82 px-4 text-sm font-black text-[#202124] shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition active:scale-95"
          >
            返回
          </Link>
        </header>

        <section className="px-5 pt-8">
          <div className="rounded-[1.5rem] bg-[#edf8f4] px-4 py-4">
            <p className="text-[0.72rem] font-black tracking-[0.16em] text-[#4f8d7c]">保養紀錄</p>
            <h1 className="mt-2 text-[1.35rem] font-black text-slate-950">{record.name}</h1>
            <p className="mt-1 text-[0.9rem] font-semibold text-slate-500">{formatDate(record.completedOn)}</p>
            <p className="mt-2 text-[0.78rem] font-semibold text-slate-600">
              {frequencyLabel(record.frequency)}
              {record.accountName ? ` · ${record.accountName}` : ''}
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.35rem] border border-[#ece8e1] bg-white">
            <label className="block border-b border-[#ece8e1] px-4 py-3">
              <span className="text-[0.72rem] font-black tracking-[0.14em] text-slate-400">完成日期</span>
              <input
                type="date"
                value={completedOn}
                onChange={(event) => setCompletedOn(event.target.value)}
                onBlur={handleDateBlur}
                className="mt-2 w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-[0.95rem] font-black text-slate-900 focus:border-[#4f8d7c] focus:outline-none"
              />
              {pendingField === 'completed_on' ? (
                <p className="mt-2 text-[0.72rem] font-bold text-[#4f8d7c]">儲存中…</p>
              ) : null}
            </label>

            <label className="block px-4 py-3">
              <span className="text-[0.72rem] font-black tracking-[0.14em] text-slate-400">備註</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onBlur={handleNoteBlur}
                rows={6}
                placeholder="補充這次保養做了什麼"
                className="mt-2 w-full rounded-xl border border-[#e5e7eb] px-3 py-2 text-[0.95rem] font-semibold text-slate-900 focus:border-[#4f8d7c] focus:outline-none"
              />
              {pendingField === 'note' ? (
                <p className="mt-2 text-[0.72rem] font-bold text-[#4f8d7c]">儲存中…</p>
              ) : null}
            </label>
          </div>

          {message ? (
            <p className={`mt-4 text-sm font-black ${message.tone === 'error' ? 'text-[#c9563f]' : 'text-[#2f7d3b]'}`}>
              {message.text}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/reminders/${encodeURIComponent(record.reminderId)}`}
              className="inline-flex items-center justify-center rounded-full border border-[#d7def7] bg-[#f6f8ff] px-4 py-2 text-sm font-black text-[#4f5fb8]"
            >
              看這個項目全部歷史
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`${primaryButtonClass} border-[#c9563f] bg-[#c9563f] hover:bg-[#b64b36] disabled:opacity-50`}
            >
              {deleting ? '刪除中…' : '刪除這筆'}
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}
