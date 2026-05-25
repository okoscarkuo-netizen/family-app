import { createAdminClient } from '@/lib/supabase/admin'

const CBC_DAILY_RATES_URL =
  'https://www.cbc.gov.tw/public/data/OpenData/%E7%B6%93%E7%A0%94%E8%99%95/BP01D01.csv'

const RATE_REVALIDATE_SECONDS = 60 * 60
const RATE_SNAPSHOT_TABLE = 'exchange_rate_snapshots'

export type TwdRateSnapshot = {
  date: string
  sourceDate: string
  source: 'cbc'
  rates: Record<string, number>
}

export type TwdRateTable = {
  dates: string[]
  byDate: Record<string, TwdRateSnapshot>
  latest: TwdRateSnapshot
  officialLatestDate: string | null
  checkedAt: string
}

type ExchangeRateSnapshotRow = {
  snapshot_date: string
  source_date: string
  source: TwdRateSnapshot['source']
  rates: Record<string, number> | null
  checked_at: string | null
  updated_at: string | null
}

const fallbackSnapshot: TwdRateSnapshot = {
  date: '1970-01-01',
  sourceDate: '1970-01-01',
  source: 'cbc',
  rates: { TWD: 1 },
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseNumber(value: string | undefined) {
  const numberValue = Number(String(value ?? '').trim())
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function yyyymmddToDateKey(value: string | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function maxIsoDate(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b ?? null
  if (!b) return a
  return a > b ? a : b
}

function normalizeRates(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { TWD: 1 }
  }

  const rates: Record<string, number> = { TWD: 1 }

  for (const [currency, amount] of Object.entries(value as Record<string, unknown>)) {
    const normalized = Number(amount)
    if (Number.isFinite(normalized) && normalized > 0) {
      rates[currency.toUpperCase()] = normalized
    }
  }

  rates.TWD = 1
  return rates
}

function parseCbcDailyRates(csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const rows = lines.slice(1)
  const snapshots: TwdRateSnapshot[] = []

  for (const line of rows) {
    const columns = parseCsvLine(line)
    const dateKey = yyyymmddToDateKey(columns[0])
    const twdPerUsd = parseNumber(columns[1])
    const jpyPerUsd = parseNumber(columns[2])

    if (!dateKey || !twdPerUsd) continue

    const rates: Record<string, number> = {
      TWD: 1,
      USD: twdPerUsd,
    }

    if (jpyPerUsd) rates.JPY = twdPerUsd / jpyPerUsd

    snapshots.push({
      date: dateKey,
      sourceDate: dateKey,
      source: 'cbc',
      rates,
    })
  }

  return snapshots
}

function buildRateTableFromSnapshots(snapshots: TwdRateSnapshot[], checkedAt: string) {
  const byDate: Record<string, TwdRateSnapshot> = {}
  const dates = snapshots.map((snapshot) => snapshot.date).sort()

  for (const snapshot of snapshots) {
    byDate[snapshot.date] = snapshot
  }

  const latestDate = dates.at(-1) ?? fallbackSnapshot.date
  const latest = byDate[latestDate] ?? fallbackSnapshot
  const officialLatestDate = dates.at(-1) ?? null

  return {
    dates,
    byDate,
    latest,
    officialLatestDate,
    checkedAt,
  } satisfies TwdRateTable
}

function rowToSnapshot(row: ExchangeRateSnapshotRow): TwdRateSnapshot | null {
  const date = yyyymmddToDateKey(row.snapshot_date) ?? row.snapshot_date
  if (!date) return null

  return {
    date,
    sourceDate: yyyymmddToDateKey(row.source_date) ?? row.source_date ?? date,
    source: row.source ?? 'cbc',
    rates: normalizeRates(row.rates),
  }
}

function buildRateTableFromRows(rows: ExchangeRateSnapshotRow[]) {
  const snapshots: TwdRateSnapshot[] = []
  let checkedAt = ''

  for (const row of rows) {
    const snapshot = rowToSnapshot(row)
    if (!snapshot) continue

    snapshots.push(snapshot)
    checkedAt = maxIsoDate(checkedAt, row.checked_at) ?? checkedAt
    checkedAt = maxIsoDate(checkedAt, row.updated_at) ?? checkedAt
  }

  if (!snapshots.length) return null

  return buildRateTableFromSnapshots(snapshots, checkedAt || new Date().toISOString())
}

async function getCbcDailyRateRows() {
  const response = await fetch(CBC_DAILY_RATES_URL, {
    next: { revalidate: RATE_REVALIDATE_SECONDS },
  })

  if (!response.ok) {
    throw new Error(`CBC exchange-rate fetch failed: ${response.status}`)
  }

  return parseCbcDailyRates(await response.text())
}

async function getStoredRateTable() {
  const supabase = createAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from(RATE_SNAPSHOT_TABLE)
    .select('snapshot_date, source_date, source, rates, checked_at, updated_at')
    .order('snapshot_date', { ascending: true })

  if (error || !data?.length) return null

  return buildRateTableFromRows(data as ExchangeRateSnapshotRow[])
}

async function storeRateTable(table: TwdRateTable) {
  const supabase = createAdminClient()
  if (!supabase) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for exchange-rate sync.')
  }

  const checkedAt = table.checkedAt || new Date().toISOString()
  const rows = table.dates
    .map((date) => {
      const snapshot = table.byDate[date]
      if (!snapshot) return null

      return {
        snapshot_date: snapshot.date,
        source_date: snapshot.sourceDate,
        source: snapshot.source,
        rates: snapshot.rates,
        checked_at: checkedAt,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!rows.length) return

  const { error } = await supabase.from(RATE_SNAPSHOT_TABLE).upsert(rows, {
    onConflict: 'snapshot_date',
  })

  if (error) throw error
}

async function fetchCbcRateTable() {
  const snapshots = await getCbcDailyRateRows()
  const checkedAt = new Date().toISOString()
  return buildRateTableFromSnapshots(snapshots, checkedAt)
}

export async function refreshTwdRateTable(): Promise<TwdRateTable> {
  const table = await fetchCbcRateTable()
  await storeRateTable(table)
  return table
}

export async function getTwdRateTable(): Promise<TwdRateTable> {
  const stored = await getStoredRateTable()
  if (stored) return stored

  const table = await fetchCbcRateTable()

  void storeRateTable(table).catch(() => {
    // The page can still render from live official data if persistence is unavailable.
  })

  return table
}

export function getRateSnapshotForDate(table: TwdRateTable, dateKey: string): TwdRateSnapshot {
  if (!table.dates.length) return table.latest

  if (table.officialLatestDate && dateKey > table.officialLatestDate && table.latest.date > table.officialLatestDate) {
    return table.latest
  }

  let left = 0
  let right = table.dates.length - 1
  let result = table.dates[0]

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const candidate = table.dates[mid]

    if (candidate <= dateKey) {
      result = candidate
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return table.byDate[result] ?? table.latest
}

export function convertToTwd(amount: number, currency: string | null | undefined, snapshot: TwdRateSnapshot) {
  const code = String(currency || 'TWD').toUpperCase()
  const rate = code === 'TWD' ? 1 : snapshot.rates[code]
  return amount * (Number.isFinite(rate) && rate > 0 ? rate : 1)
}

export function convertBetweenCurrencies(
  amount: number,
  fromCurrency: string | null | undefined,
  toCurrency: string | null | undefined,
  snapshot: TwdRateSnapshot,
) {
  const fromCode = String(fromCurrency || 'TWD').toUpperCase()
  const toCode = String(toCurrency || 'TWD').toUpperCase()
  const fromRate = fromCode === 'TWD' ? 1 : snapshot.rates[fromCode]
  const toRate = toCode === 'TWD' ? 1 : snapshot.rates[toCode]

  if (!Number.isFinite(fromRate) || fromRate <= 0) return null
  if (!Number.isFinite(toRate) || toRate <= 0) return null

  return amount * (fromRate / toRate)
}
