export type BackupSchedule = 'biweekly' | 'monthly'

export type BackupConfig = {
  schedule: BackupSchedule
  biweeklyAnchorDate: string // YYYY-MM-DD
  lastSentAt: string | null // ISO timestamp
}

function toUtcDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function isFriday(date: Date): boolean {
  return date.getUTCDay() === 5
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / 86_400_000)
}

export function firstFridayOfMonth(year: number, month: number): Date {
  // month: 1-12
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (5 - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month - 1, 1 + offset))
}

export function shouldSendToday(today: Date, config: BackupConfig): boolean {
  if (!isFriday(today)) return false

  if (config.schedule === 'biweekly') {
    const anchor = toUtcDate(config.biweeklyAnchorDate)
    const diff = daysBetween(today, anchor)
    return diff >= 0 && diff % 14 === 0
  }

  if (config.schedule === 'monthly') {
    const target = firstFridayOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1)
    return (
      today.getUTCFullYear() === target.getUTCFullYear() &&
      today.getUTCMonth() === target.getUTCMonth() &&
      today.getUTCDate() === target.getUTCDate()
    )
  }

  return false
}

export function nextSendDate(today: Date, config: BackupConfig): Date {
  if (config.schedule === 'biweekly') {
    const anchor = toUtcDate(config.biweeklyAnchorDate)
    if (today.getTime() <= anchor.getTime()) return anchor
    const diff = daysBetween(today, anchor)
    const remainder = diff % 14
    const addDays = remainder === 0 ? 0 : 14 - remainder
    return new Date(today.getTime() + addDays * 86_400_000)
  }

  // monthly: this month's first Friday if still in future-or-today, else next month's
  const thisMonthFri = firstFridayOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1)
  if (thisMonthFri.getTime() >= today.getTime()) return thisMonthFri
  let y = today.getUTCFullYear()
  let m = today.getUTCMonth() + 2 // next month, 1-based
  if (m > 12) {
    m = 1
    y += 1
  }
  return firstFridayOfMonth(y, m)
}

export function formatDateYmd(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
