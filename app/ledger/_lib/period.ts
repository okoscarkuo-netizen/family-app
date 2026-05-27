export type LedgerView = 'year' | 'month' | 'week' | 'day'

export const LEDGER_VIEWS: LedgerView[] = ['year', 'month', 'week', 'day']

const DAY_MS = 24 * 60 * 60 * 1000

function cloneAtNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
}

export function parseLedgerView(value: string | undefined | null): LedgerView {
  return value && LEDGER_VIEWS.includes(value as LedgerView) ? (value as LedgerView) : 'month'
}

export function parseDateValue(value: string | undefined | null): Date | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day, 12)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfWeek(date: Date) {
  const value = cloneAtNoon(date)
  const weekday = value.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  value.setDate(value.getDate() + diff)
  return value
}

export function endOfWeek(date: Date) {
  const value = startOfWeek(date)
  value.setDate(value.getDate() + 6)
  return value
}

export function getLedgerRange(view: LedgerView, anchorDate: Date) {
  if (view === 'year') {
    const start = new Date(anchorDate.getFullYear(), 0, 1, 12)
    const end = new Date(anchorDate.getFullYear(), 11, 31, 12)
    return { start, end }
  }

  if (view === 'week') {
    const start = startOfWeek(anchorDate)
    const end = endOfWeek(anchorDate)
    return { start, end }
  }

  if (view === 'day') {
    const start = cloneAtNoon(anchorDate)
    const end = cloneAtNoon(anchorDate)
    return { start, end }
  }

  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12)
  const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 12)
  return { start, end }
}

export function shiftLedgerDate(view: LedgerView, anchorDate: Date, delta: number) {
  const next = cloneAtNoon(anchorDate)

  if (view === 'year') {
    next.setFullYear(next.getFullYear() + delta)
    return next
  }

  if (view === 'month') {
    next.setDate(1)
    next.setMonth(next.getMonth() + delta)
    return next
  }

  if (view === 'week') {
    next.setDate(next.getDate() + delta * 7)
    return next
  }

  next.setDate(next.getDate() + delta)
  return next
}

export function formatLedgerTitle(view: LedgerView, anchorDate: Date) {
  if (view === 'year') {
    return `${anchorDate.getFullYear()}`
  }

  if (view === 'month') {
    return `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`
  }

  if (view === 'week') {
    const start = startOfWeek(anchorDate)
    const end = endOfWeek(anchorDate)
    return `${formatDateKey(start)} ~ ${formatDateKey(end)}`
  }

  return formatDateKey(anchorDate)
}

export function sameLedgerPeriod(view: LedgerView, left: Date, right: Date) {
  if (view === 'year') return left.getFullYear() === right.getFullYear()
  if (view === 'month') return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
  if (view === 'week') {
    const leftStart = startOfWeek(left)
    const rightStart = startOfWeek(right)
    return formatDateKey(leftStart) === formatDateKey(rightStart)
  }

  return formatDateKey(left) === formatDateKey(right)
}

export function resolveLedgerAnchorDate(params: {
  date?: string
  year?: string
  month?: string
  fallback: Date
}) {
  const parsedDate = parseDateValue(params.date)
  if (parsedDate) return parsedDate

  const year = Number.parseInt(params.year ?? '', 10)
  const month = Number.parseInt(params.month ?? '', 10)
  if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
    return new Date(year, month - 1, 1, 12)
  }

  return cloneAtNoon(params.fallback)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}
