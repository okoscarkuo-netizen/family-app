import Link from 'next/link'
import {
  getTransferAmountForAccount,
  getTransferDisplayAmounts,
  type FamilyTransaction,
} from '@/lib/family-transactions'
import type { MaintenanceRecord } from '@/lib/reminders-db'
import { softSurfaceClass } from '@/components/PageShell'
import { getCategoryDisplayIcon } from '@/lib/category-icons'
import { CategoryIcon } from '@/components/CategoryIcon'
import { LoadMoreTransactionsLink } from '@/app/ledger/_components/LoadMoreTransactionsLink'

type LedgerAccount = {
  id: string
  name: string
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const KIND_LABEL: Record<FamilyTransaction['kind'], string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
}

export type LedgerListItem = FamilyTransaction | MaintenanceRecord

function isMaintenanceRecord(item: LedgerListItem): item is MaintenanceRecord {
  return 'type' in item && item.type === 'maintenance'
}

function amountClass(kind: FamilyTransaction['kind']) {
  if (kind === 'income') return 'text-[#23b99f]'
  if (kind === 'expense') return 'text-[#df7d77]'
  return 'text-[#8d9298]'
}

function iconClass() {
  return 'border-[#e2e4e8] bg-[#f7f7f5] text-[#5e646d] shadow-[0_1px_0_rgba(15,23,42,0.02)]'
}

function formatMoney(value: number, currency?: string): string {
  const formatted = Math.abs(value).toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency && currency !== 'TWD' ? `${formatted} ${currency}` : formatted
}

function formatTransferMoney(value: number, currency: string): string {
  const amount = formatMoney(value, currency)
  return currency === 'TWD' ? `NT$${Math.abs(value).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : amount
}

function groupByDate(items: LedgerListItem[]): Array<{ date: string; items: LedgerListItem[] }> {
  const map = new Map<string, LedgerListItem[]>()
  for (const item of items) {
    const existing = map.get(item.occurred_on)
    if (existing) {
      existing.push(item)
    } else {
      map.set(item.occurred_on, [item])
    }
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
}

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    day: `${d.getDate()}日`,
    context: `${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()} 週${WEEKDAYS[d.getDay()]}`,
  }
}

function formatTime(item: LedgerListItem): string {
  const value = isMaintenanceRecord(item) ? item.created_at : (item.occurred_at ?? item.created_at)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''

  return d.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getAccountName(accountId: string | null | undefined, accountNames: Map<string, string>) {
  if (!accountId) return null
  return accountNames.get(accountId) ?? null
}

function getTransactionTitle(item: LedgerListItem, accountNames: Map<string, string>) {
  if (isMaintenanceRecord(item)) return item.name

  const tx = item
  if (tx.kind === 'transfer') {
    const from = getAccountName(tx.account_id, accountNames)
    const to = getAccountName(tx.to_account_id, accountNames)
    if (from && to) return `${from} → ${to}`
    if (tx.title.includes('→')) return tx.title
    return tx.title || '帳戶轉帳'
  }

  return tx.categoryPath || tx.category?.name || tx.merchant || tx.title || KIND_LABEL[tx.kind]
}

function getDetailLine(item: LedgerListItem, currentAccountId?: string) {
  if (isMaintenanceRecord(item)) {
    const parts = [
      item.accountName,
      item.note?.trim() || null,
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(' · ') : null
  }

  const tx = item
  const note = tx.note?.trim()

  if (tx.kind === 'transfer') {
    const transfer = currentAccountId ? getTransferAmountForAccount(tx, currentAccountId) : null
    const display = getTransferDisplayAmounts(tx)
    const transferDisplay = transfer
      ? `${transfer.role === 'source' ? '轉出' : '轉入'} ${formatTransferMoney(transfer.amount, transfer.currency)}`
      : display.isCrossCurrency
        ? `轉帳 ${formatTransferMoney(display.sourceAmount, display.sourceCurrency)} → ${formatTransferMoney(display.targetAmount, display.targetCurrency)}`
        : `轉帳 ${formatTransferMoney(display.sourceAmount, display.sourceCurrency)}`
    const counterpart = transfer && transfer.counterpartCurrency !== transfer.currency
      ? `約 ${formatTransferMoney(transfer.counterpartAmount, transfer.counterpartCurrency)}`
      : null
    const parts = [transferDisplay, counterpart, note].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  const merchant = tx.merchant?.trim()
  const categoryName = tx.category?.name?.trim()
  const categoryPath = tx.categoryPath?.trim()
  const merchantDuplicatesCategory =
    !!merchant &&
    (merchant === categoryName || (categoryPath ? categoryPath.endsWith(merchant) : false))
  const merchantPart = merchant && !merchantDuplicatesCategory ? merchant : null

  const parts = [merchantPart, note].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

function getMetaLine(item: LedgerListItem, accountNames: Map<string, string>) {
  if (isMaintenanceRecord(item)) {
    const time = formatTime(item)
    const frequencyLabel =
      item.frequency === 'once' ? '一次' :
      item.frequency === 'weekly' ? '每週' :
      item.frequency === 'monthly' ? '每月' :
      item.frequency === 'quarterly' ? '每三個月' :
      item.frequency === 'semiannual' ? '每半年' :
      '每年'
    const parts = [time, '保養', frequencyLabel].filter(Boolean)
    return parts.join(' · ')
  }

  const tx = item
  const time = formatTime(tx)
  const account = getAccountName(tx.account_id, accountNames)
  const parts = [time, account, tx.owner].filter(Boolean)
  return parts.join(' · ')
}

function getTransactionIcon(item: LedgerListItem) {
  if (isMaintenanceRecord(item)) return '養'

  const tx = item
  if (tx.category) return getCategoryDisplayIcon(tx.category)
  if (tx.kind === 'transfer') return '轉'
  if (tx.kind === 'income') return '入'
  return '出'
}

function getDaySummary(items: LedgerListItem[]) {
  return items.reduce(
    (summary, item) => {
      if (isMaintenanceRecord(item)) return summary
      const tx = item
      if (tx.kind === 'income') {
        summary.income += Math.abs(tx.amount)
      }
      if (tx.kind === 'expense') {
        summary.expense += Math.abs(tx.amount)
      }
      return summary
    },
    { income: 0, expense: 0 },
  )
}

type Props = {
  transactions: LedgerListItem[]
  accounts: LedgerAccount[]
  currentAccountId?: string
  returnUrl?: string
  totalCount?: number
  loadMoreHref?: string
}

export function TransactionList({
  transactions,
  accounts,
  currentAccountId,
  returnUrl,
  totalCount,
  loadMoreHref,
}: Props) {
  if (transactions.length === 0) {
    return (
      <div className={`${softSurfaceClass} border-dashed text-center text-sm font-black text-slate-500`}>
        目前沒有符合此檢視條件的記錄，點右上角「＋ 新增」開始記帳
      </div>
    )
  }

  const groups = groupByDate(transactions)
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  const hasMore = Boolean(totalCount && totalCount > transactions.length)
  const safeTotalCount = totalCount ?? transactions.length

  return (
    <div>
      {groups.map(({ date, items }) => (
        <section key={date} className="border-t-2 border-[#f4f4f2] bg-white first:border-t-0">
          <DayHeader date={date} items={items} />

          <div className="pb-0.5">
            {items.map((tx) => {
              const detailLine = getDetailLine(tx, currentAccountId)
              const metaLine = getMetaLine(tx, accountNames)
              const isMaintenance = isMaintenanceRecord(tx)
              const href = isMaintenance
                ? `/reminders/records/${encodeURIComponent(tx.id)}${returnUrl ? `?from=${encodeURIComponent(returnUrl)}` : ''}`
                : `/ledger/${encodeURIComponent(tx.id)}${returnUrl ? `?from=${encodeURIComponent(returnUrl)}` : ''}`

              return (
                <Link
                  key={tx.id}
                  href={href}
                  className="group flex items-start gap-2.5 px-4 py-1.5 transition hover:bg-[#fafaf8] active:bg-[#f4f4f2]"
                  aria-label={isMaintenance ? `查看保養 ${getTransactionTitle(tx, accountNames)}` : `查看 ${getTransactionTitle(tx, accountNames)}`}
                >
                  {!isMaintenance && tx.category ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden" aria-hidden="true">
                      <CategoryIcon icon={getCategoryDisplayIcon(tx.category)} size={40} />
                    </div>
                  ) : (
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[0.58rem] font-semibold leading-none tracking-[-0.02em] ${iconClass()}`}
                      aria-hidden="true"
                    >
                      {getTransactionIcon(tx)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.92rem] font-semibold leading-[1.1rem] text-[#202124]">
                      {getTransactionTitle(tx, accountNames)}
                    </div>
                    {detailLine ? (
                      <div className="mt-[0.125rem] truncate text-[0.75rem] font-medium leading-4 text-[#a8adb3]">
                        {detailLine}
                      </div>
                    ) : null}
                    {metaLine ? (
                      <div className="mt-[0.125rem] truncate text-[0.68rem] font-medium leading-4 text-[#b4b8bd]">
                        {metaLine}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex w-[6.1rem] shrink-0 flex-col items-end text-right">
                    {isMaintenance ? (
                      <>
                        <div className="rounded-full bg-[#edf8f4] px-2.5 py-1 text-[0.68rem] font-black text-[#356f5f]">
                          保養
                        </div>
                        <div className="mt-1 whitespace-nowrap text-[0.68rem] font-semibold text-[#a8adb3]">
                          無金額
                        </div>
                      </>
                    ) : tx.kind === 'transfer' ? (() => {
                      const transfer = getTransferDisplayAmounts(tx)
                      const primary = formatTransferMoney(transfer.sourceAmount, transfer.sourceCurrency)
                      if (!transfer.isCrossCurrency) {
                        return (
                          <div className={`whitespace-nowrap text-[0.92rem] font-semibold leading-[1.1rem] ${amountClass(tx.kind)}`}>
                            {primary}
                          </div>
                        )
                      }
                      return (
                        <>
                          <div className={`whitespace-nowrap text-[0.92rem] font-semibold leading-[1.1rem] ${amountClass(tx.kind)}`}>
                            {primary}
                          </div>
                          <div className="whitespace-nowrap text-[0.75rem] font-medium leading-[1.1rem] text-[#a8adb3]">
                            → {formatTransferMoney(transfer.targetAmount, transfer.targetCurrency)}
                          </div>
                        </>
                      )
                    })() : (
                      <div className={`whitespace-nowrap text-[0.92rem] font-semibold leading-[1.1rem] ${amountClass(tx.kind)}`}>
                        {formatMoney(tx.amount, tx.currency)}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
      {hasMore && loadMoreHref ? (
        <div className="border-t-2 border-[#f4f4f2] bg-white px-4 py-4">
          <LoadMoreTransactionsLink
            href={loadMoreHref}
            shownCount={transactions.length}
            totalCount={safeTotalCount}
          />
        </div>
      ) : null}
    </div>
  )
}

function DayHeader({ date, items }: { date: string; items: LedgerListItem[] }) {
  const { day, context } = formatDateParts(date)
  const { income, expense } = getDaySummary(items)
  const balance = income - expense

  return (
    <div className="flex items-start justify-between gap-2.5 px-4 pb-0.5 pt-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <div className="shrink-0 text-[1.2rem] font-semibold leading-none text-[#202124]">{day}</div>
        <div className="truncate text-[0.72rem] font-semibold text-[#b1b5ba]">{context}</div>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-x-2 gap-y-0.5 pt-0.5 text-[0.63rem] font-semibold text-[#b7bbc0]">
        <span>
          <span className="text-[#2dbba2]">收</span> {formatMoney(income)}
        </span>
        <span>
          <span className="text-[#df9c96]">支</span> {formatMoney(expense)}
        </span>
        <span>
          <span className="text-[#d6a61d]">餘</span> {balance < 0 ? '-' : ''}
          {formatMoney(balance)}
        </span>
      </div>
    </div>
  )
}
