'use client'

import { useTransition } from 'react'
import { completeReminder } from '@/app/actions/reminders'

export function ReminderCompleteButton({ reminderId }: { reminderId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const data = new FormData()
      data.set('reminder_id', reminderId)
      await completeReminder(data)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 rounded-full border border-[#d6e8df] bg-white px-3 py-1.5 text-[0.72rem] font-black text-[#4f8d7c] shadow-sm transition hover:bg-[#edf8f4] active:scale-95 disabled:opacity-50"
    >
      {isPending ? '處理中…' : '完成'}
    </button>
  )
}
