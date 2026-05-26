import type { FamilyAccount } from '@/lib/finance/types'
import type { NetWorthTrendTransaction } from '@/lib/family-transactions'
import {
  convertToTwd,
  getRateSnapshotForDate,
  type TwdRateSnapshot,
  type TwdRateTable,
} from '@/lib/exchange-rates'
import { AssetTrendChart } from './AssetTrendChart'

type Props = {
  accounts: FamilyAccount[]
  transactions: NetWorthTrendTransaction[]
  rateTable: TwdRateTable
}

type TrendPoint = {
  label: string
  value: number
  dateKey: string
}

type MonthTick = {
  label: string
  position: number
}

function formatCurrency(value: number) {
  return `NT$${new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(value)}`
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatMonthLabel(date: Date, withYear = false) {
  const month = date.getMonth() + 1
  if (!withYear) return `${month}月`

  const year = String(date.getFullYear()).slice(-2)
  return `${month}月 '${year}`
}

function parseLocalDate(dateKey: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateKey ?? ''))
  if (!match) return null

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateKey: string, dayDelta: number) {
  const date = parseLocalDate(dateKey)
  if (!date) return dateKey

  date.setDate(date.getDate() + dayDelta)
  return formatDateKey(date)
}

function previousMonthEndDateKey(dateKey: string) {
  const date = parseLocalDate(dateKey)
  if (!date) return dateKey

  return formatDateKey(new Date(date.getFullYear(), date.getMonth(), 0, 12))
}

function todayDateKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Phoenix',
    year: 'numeric',
  }).formatToParts(new Date())
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${byType.year}-${byType.month}-${byType.day}`
}

function normalizeTransactionDate(transaction: NetWorthTrendTransaction) {
  const date = parseLocalDate(transaction.occurred_on ?? transaction.occurred_at?.slice(0, 10))
  return date ? formatDateKey(date) : null
}

function addCurrencyAmount(balances: Record<string, number>, currency: string, amount: number) {
  const code = currency.toUpperCase()
  balances[code] = (balances[code] ?? 0) + amount
}

function cloneBalances(balances: Record<string, number>) {
  return Object.fromEntries(Object.entries(balances))
}

function convertedBalanceTotal(balances: Record<string, number>, snapshot: TwdRateSnapshot) {
  return Object.entries(balances).reduce(
    (sum, [currency, amount]) => sum + convertToTwd(amount, currency, snapshot),
    0,
  )
}

function accountTotal(accounts: FamilyAccount[], kind: FamilyAccount['kind'], snapshot: TwdRateSnapshot) {
  return accounts
    .filter((account) => !account.hidden && account.kind === kind)
    .reduce((sum, account) => sum + convertToTwd(account.balance, account.currency, snapshot), 0)
}

function currentNetBalancesByCurrency(accounts: FamilyAccount[]) {
  const balances: Record<string, number> = {}

  for (const account of accounts) {
    if (account.hidden) continue
    const signedBalance = account.kind === 'asset' ? account.balance : -account.balance
    addCurrencyAmount(balances, account.currency || 'TWD', signedBalance)
  }

  return balances
}

function buildTrendPoints(
  currentBalances: Record<string, number>,
  transactions: NetWorthTrendTransaction[],
  rateTable: TwdRateTable,
) {
  const deltas = transactions
    .filter((transaction) => transaction.kind !== 'transfer')
    .map((transaction) => {
      const dateKey = normalizeTransactionDate(transaction)
      return {
        amount: transaction.kind === 'income' ? transaction.amount : -transaction.amount,
        currency: transaction.currency || 'TWD',
        dateKey,
      }
    })
    .filter((entry): entry is { amount: number; currency: string; dateKey: string } => Boolean(entry.dateKey))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))

  const endDateKey = [todayDateKey(), rateTable.latest.date, deltas.at(-1)?.dateKey ?? ''].reduce(
    (latest, dateKey) => (dateKey && dateKey > latest ? dateKey : latest),
    '1970-01-01',
  )
  const monthBaselineDateKey = previousMonthEndDateKey(endDateKey)

  if (!deltas.length) {
    const points: TrendPoint[] = []
    let dateCursor = monthBaselineDateKey

    while (dateCursor <= endDateKey) {
      points.push({
        label: dateCursor === endDateKey ? '現在' : '',
        value: convertedBalanceTotal(currentBalances, getRateSnapshotForDate(rateTable, dateCursor)),
        dateKey: dateCursor,
      })

      dateCursor = addDays(dateCursor, 1)
    }

    return points.length
      ? points
      : [{
        label: '現在',
        value: convertedBalanceTotal(currentBalances, getRateSnapshotForDate(rateTable, endDateKey)),
        dateKey: endDateKey,
      }]
  }

  const totalDeltas: Record<string, number> = {}
  const deltasByDate = new Map<string, Array<{ amount: number; currency: string }>>()

  for (const delta of deltas) {
    addCurrencyAmount(totalDeltas, delta.currency, delta.amount)
    deltasByDate.set(delta.dateKey, [...(deltasByDate.get(delta.dateKey) ?? []), delta])
  }

  const runningBalances = cloneBalances(currentBalances)
  for (const [currency, amount] of Object.entries(totalDeltas)) {
    addCurrencyAmount(runningBalances, currency, -amount)
  }

  const startDateKey = [addDays(deltas[0].dateKey, -1), monthBaselineDateKey].reduce(
    (earliest, dateKey) => (dateKey < earliest ? dateKey : earliest),
  )
  const points: TrendPoint[] = []
  let dateCursor = startDateKey

  while (dateCursor <= endDateKey) {
    for (const delta of deltasByDate.get(dateCursor) ?? []) {
      addCurrencyAmount(runningBalances, delta.currency, delta.amount)
    }

    const snapshot = getRateSnapshotForDate(rateTable, dateCursor)
    points.push({
      label: '',
      value: convertedBalanceTotal(runningBalances, snapshot),
      dateKey: dateCursor,
    })

    dateCursor = addDays(dateCursor, 1)
  }

  return points
}

function findPointOnOrBefore(points: TrendPoint[], dateKey: string) {
  let fallback: TrendPoint | null = null

  for (const point of points) {
    if (point.dateKey > dateKey) break
    fallback = point
  }

  return fallback
}

function buildMonthTicks(points: TrendPoint[]): MonthTick[] {
  if (!points.length) return []

  const visibleCount = Math.min(6, points.length)
  const lastIndex = points.length - 1
  const yearsInRange = new Set(points.map((point) => parseLocalDate(point.dateKey)?.getFullYear()))
  const useYearLabels = yearsInRange.size > 1
  const selectedIndices = Array.from({ length: visibleCount }, (_, index) =>
    visibleCount === 1 ? 0 : Math.round((lastIndex * index) / (visibleCount - 1)),
  )

  return selectedIndices.map((index) => {
    const point = points[index]
    const date = parseLocalDate(point.dateKey) ?? new Date()
    return {
      label: formatMonthLabel(date, useYearLabels),
      position: lastIndex === 0 ? 0 : index / lastIndex,
    }
  })
}

export function AssetTrendCard({ accounts, transactions, rateTable }: Props) {
  const visibleAccounts = accounts.filter((account) => !account.hidden)
  const currentRate = rateTable.latest
  const assetTotal = accountTotal(visibleAccounts, 'asset', currentRate)
  const liabilityTotal = accountTotal(visibleAccounts, 'liability', currentRate)
  const netAssets = assetTotal - liabilityTotal

  const points = buildTrendPoints(currentNetBalancesByCurrency(visibleAccounts), transactions, rateTable)
  const values = points.map((point) => point.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const flatTrend = maxValue === minValue
  const valueRange = Math.max(maxValue - minValue, 1)

  const width = 360
  const height = 220
  const paddingX = 10
  const paddingY = 18
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2 - 10

  const coordinates = points.map((point, index) => {
    const x = paddingX + (points.length === 1 ? chartWidth : (index / (points.length - 1)) * chartWidth)
    const y = flatTrend
      ? paddingY + chartHeight / 2
      : paddingY + chartHeight - ((point.value - minValue) / valueRange) * chartHeight
    return { ...point, x, y }
  })

  const linePath = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - 20} L ${coordinates[0].x} ${height - 20} Z`
  const latestPoint = coordinates[coordinates.length - 1]
  const previousMonthEndPoint = findPointOnOrBefore(coordinates, previousMonthEndDateKey(latestPoint.dateKey)) ?? coordinates[0]
  const monthlyDelta = latestPoint.value - previousMonthEndPoint.value
  const monthlyDeltaPercent = previousMonthEndPoint.value === 0
    ? 0
    : (monthlyDelta / Math.abs(previousMonthEndPoint.value)) * 100
  const positive = monthlyDelta >= 0
  const monthTicks = buildMonthTicks(points)
  const absNetAssets = Math.abs(netAssets)
  const netAssetsTextClass =
    absNetAssets >= 100_000_000 ? 'text-[2.1rem]' :
    absNetAssets >= 10_000_000  ? 'text-[2.6rem]' :
    absNetAssets >= 1_000_000   ? 'text-[3.4rem]' :
                                  'text-[4.3rem]'
  const absDelta = Math.abs(monthlyDelta)
  const deltaTextClass =
    absDelta >= 100_000_000 ? 'text-[1.1rem]' :
    absDelta >= 10_000_000  ? 'text-[1.35rem]' :
    absDelta >= 1_000_000   ? 'text-[1.65rem]' :
                              'text-[1.95rem]'

  return (
    <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[0.82rem] font-medium tracking-normal text-slate-500">淨資產</p>
            <div className="grid h-5 w-5 place-items-center rounded-full bg-[#e8f3f8] text-[0.72rem] font-black leading-none text-[#1f7fb4]">
              i
            </div>
          </div>

          <div className="text-[#0f4d73]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path d="M14 4h6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              <path d="M20 4 13 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              <path d="M10 20H4v-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              <path d="M4 20 11 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
            </svg>
          </div>
        </div>

        <div className="mt-4">
          <p className={`${netAssetsTextClass} font-normal leading-none tracking-[-0.07em] text-slate-950`}>
            {formatCurrency(netAssets)}
          </p>
          <div className="mt-3">
            <p className="text-[0.78rem] font-medium tracking-normal text-slate-500">較上月底</p>
            <p className={`mt-1.5 ${deltaTextClass} font-medium leading-none ${positive ? 'text-[#2f7d3b]' : 'text-[#c9563f]'}`}>
              {positive ? '+' : '-'}
              {formatCurrency(Math.abs(monthlyDelta))}
              <span className="ml-1 text-[1.15rem]">{`(${formatPercent(monthlyDeltaPercent)})`}</span>
            </p>
          </div>
        </div>

        <div className="mt-4">
          <AssetTrendChart
            areaPath={areaPath}
            coordinates={coordinates}
            linePath={linePath}
            monthTicks={monthTicks}
            paddingX={paddingX}
            svgHeight={height}
            svgWidth={width}
          />
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] font-bold text-slate-400">
              <span className="tracking-[0.02em]">總資產</span>
              <span className="text-[0.92rem] text-slate-600">{formatCurrency(assetTotal)}</span>
              <span className="text-slate-300">·</span>
              <span className="tracking-[0.02em]">負債</span>
              <span className="text-[0.92rem] text-slate-600">{formatCurrency(liabilityTotal)}</span>
            </p>
          </div>
        </div>
    </section>
  )
}
