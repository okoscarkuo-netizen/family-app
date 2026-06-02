'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { deleteTransaction, updateTransactionDetails } from '@/app/actions/transactions'
import { CategoryIcon } from '@/components/CategoryIcon'
import { getCategoryDisplayIcon } from '@/lib/category-icons'
import { getTransferDisplayAmounts, type FamilyMerchant, type FamilyTransaction } from '@/lib/family-transactions'
import type { FamilyAccount } from '@/lib/finance/types'

type DetailAccount = Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'owner' | 'shared' | 'favorite'>
type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
type RecurringSelection = RecurringFrequency | 'none'
type SaveField = 'account' | 'merchant' | 'note' | 'recurring'

type Props = {
  transaction: FamilyTransaction
  accounts: DetailAccount[]
  merchants: FamilyMerchant[]
  recurringFrequency: RecurringFrequency | null
  recurringSupported: boolean
  returnUrl: string
}

type DetailDraft = {
  accountId: string
  toAccountId: string
  merchant: string
  note: string
  recurringFrequency: RecurringSelection
}

const KIND_LABELS: Record<FamilyTransaction['kind'], string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
}

const FREQUENCY_LABELS: Record<RecurringSelection, string> = {
  none: '未設定',
  weekly: '每週',
  monthly: '每月',
  quarterly: '每季',
  yearly: '每年',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none">
      <path d="m15 19-7-7 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="m13.5 6.5 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="M8 7.5V5.8A2.8 2.8 0 0 1 10.8 3H18a2 2 0 0 1 2 2v7.2a2.8 2.8 0 0 1-2.8 2.8H15.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10.8A2.8 2.8 0 0 1 6.8 8H14a2 2 0 0 1 2 2v7.2a2.8 2.8 0 0 1-2.8 2.8H6a2 2 0 0 1-2-2v-7.2Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="M5 7h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.9" />
      <path d="m8 10 .6 9h6.8l.6-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  )
}

function FieldIcon({ label }: { label: string }) {
  const icon = label === '帳戶' || label === '轉出帳戶' || label === '轉入帳戶'
    ? '🏦'
    : label === '商家'
      ? '🏪'
      : label === '週期'
        ? '↻'
        : '✎'

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[1.45rem]" aria-hidden="true">
      {icon}
    </span>
  )
}

function amountClass(kind: FamilyTransaction['kind']) {
  if (kind === 'income') return 'text-[#2f7d3b]'
  if (kind === 'expense') return 'text-[#c9563f]'
  return 'text-[#5f6368]'
}

function formatAmount(value: number, currency: string) {
  const formatted = Math.abs(value).toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${formatted}`
}

function formatHeaderAmount(transaction: FamilyTransaction) {
  if (transaction.kind !== 'transfer') {
    return formatAmount(transaction.amount, transaction.currency || 'TWD')
  }

  const transfer = getTransferDisplayAmounts(transaction)
  const source = formatAmount(transfer.sourceAmount, transfer.sourceCurrency)
  if (!transfer.isCrossCurrency) return source
  return `${source} → ${formatAmount(transfer.targetAmount, transfer.targetCurrency)}`
}

function formatDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  return `${dateStr} (週${WEEKDAYS[date.getDay()]})`
}

function accountOptionLabel(account: DetailAccount) {
  const suffix = account.favorite ? ' ★' : ''
  const currency = account.currency || 'TWD'
  const name = account.name.trim()
  const needsCurrency = !name.includes(`(${currency})`)
  return `${name}${needsCurrency ? ` (${currency})` : ''}${suffix}`
}

function buildFormData(draft: DetailDraft, includeRecurring: boolean) {
  const formData = new FormData()
  formData.set('account_id', draft.accountId)
  formData.set('to_account_id', draft.toAccountId)
  formData.set('merchant', draft.merchant)
  formData.set('note', draft.note)
  if (includeRecurring) {
    formData.set('recurring_frequency', draft.recurringFrequency)
  }
  return formData
}

export function TransactionDetail({
  transaction,
  accounts,
  merchants,
  recurringFrequency,
  recurringSupported,
  returnUrl,
}: Props) {
  const router = useRouter()
  const initialDraft: DetailDraft = {
    accountId: transaction.account_id ?? '',
    toAccountId: transaction.to_account_id ?? '',
    merchant: transaction.merchant ?? '',
    note: transaction.note ?? '',
    recurringFrequency: recurringFrequency ?? 'none',
  }
  const savedDraftRef = useRef(initialDraft)
  const saveSeqRef = useRef(0)
  const [accountId, setAccountId] = useState(initialDraft.accountId)
  const [toAccountId, setToAccountId] = useState(initialDraft.toAccountId)
  const [merchant, setMerchant] = useState(initialDraft.merchant)
  const [note, setNote] = useState(initialDraft.note)
  const [frequency, setFrequency] = useState<RecurringSelection>(initialDraft.recurringFrequency)
  const [pendingField, setPendingField] = useState<SaveField | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const title = transaction.kind === 'transfer'
    ? '帳戶轉帳'
    : transaction.categoryPath || transaction.category?.name || transaction.merchant || transaction.title || KIND_LABELS[transaction.kind]
  const editHref = `/ledger/${encodeURIComponent(transaction.id)}/edit?from=${encodeURIComponent(returnUrl)}`
  const copyHref = `/ledger/new?copyFrom=${encodeURIComponent(transaction.id)}`
  const merchantOptionsId = `merchant-options-${transaction.id}`

  function currentDraft(overrides: Partial<DetailDraft> = {}): DetailDraft {
    return {
      accountId,
      toAccountId,
      merchant,
      note,
      recurringFrequency: frequency,
      ...overrides,
    }
  }

  async function save(overrides: Partial<DetailDraft>, field: SaveField) {
    const nextDraft = currentDraft(overrides)
    const seq = saveSeqRef.current + 1
    saveSeqRef.current = seq
    setPendingField(field)
    setMessage(null)

    try {
      const result = await updateTransactionDetails(transaction.id, buildFormData(nextDraft, field === 'recurring'))
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

  function handleAccountChange(value: string) {
    setAccountId(value)
    void save({ accountId: value }, 'account')
  }

  function handleToAccountChange(value: string) {
    setToAccountId(value)
    void save({ toAccountId: value }, 'account')
  }

  function handleMerchantBlur() {
    if (merchant === savedDraftRef.current.merchant) return
    void save({ merchant }, 'merchant')
  }

  function handleNoteBlur() {
    if (note === savedDraftRef.current.note) return
    void save({ note }, 'note')
  }

  function handleFrequencyChange(value: RecurringSelection) {
    setFrequency(value)
    void save({ recurringFrequency: value }, 'recurring')
  }

  async function handleDelete() {
    if (deleting) return
    if (!window.confirm('確定要刪除這筆交易嗎？帳戶餘額也會一起沖回。')) return

    setDeleting(true)
    setMessage(null)
    try {
      await deleteTransaction(transaction.id)
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
            aria-label="返回"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/82 text-[#202124] shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition active:scale-95"
          >
            <BackIcon />
          </Link>
        </header>

        <section className="px-5 pt-8">
          <div className="flex items-start gap-4">
            <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3f3f1]">
              {transaction.category ? (
                <CategoryIcon icon={getCategoryDisplayIcon(transaction.category)} size={72} />
              ) : (
                <span className="text-xl font-black text-slate-500">{transaction.kind === 'transfer' ? '轉' : KIND_LABELS[transaction.kind][0]}</span>
              )}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <div className={`truncate text-[1.25rem] font-black leading-tight ${amountClass(transaction.kind)}`}>
                {formatHeaderAmount(transaction)}
              </div>
              <div className={`mt-1 truncate text-[1.08rem] font-black leading-tight ${amountClass(transaction.kind)}`}>
                {title}
              </div>
              <div className="mt-1 text-[0.9rem] font-semibold text-[#7d838a]">
                {formatDate(transaction.occurred_on)}
              </div>
            </div>
          </div>

          <div className="mt-7 border-y border-[#e8e8e6]">
            {transaction.kind === 'transfer' ? (
              <>
                <SelectRow
                  label="轉出帳戶"
                  value={accountId}
                  options={accounts}
                  pending={pendingField === 'account'}
                  onChange={handleAccountChange}
                />
                <SelectRow
                  label="轉入帳戶"
                  value={toAccountId}
                  options={accounts}
                  pending={pendingField === 'account'}
                  onChange={handleToAccountChange}
                />
              </>
            ) : (
              <SelectRow
                label="帳戶"
                value={accountId}
                options={accounts}
                pending={pendingField === 'account'}
                onChange={handleAccountChange}
              />
            )}

            <InputRow
              label="商家"
              value={merchant}
              optionsId={merchantOptionsId}
              pending={pendingField === 'merchant'}
              onChange={setMerchant}
              onBlur={handleMerchantBlur}
            />
            <datalist id={merchantOptionsId}>
              {merchants.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>

            <FrequencyRow
              value={frequency}
              disabled={!recurringSupported}
              pending={pendingField === 'recurring'}
              onChange={handleFrequencyChange}
            />

            <NoteRow
              value={note}
              pending={pendingField === 'note'}
              onChange={setNote}
              onBlur={handleNoteBlur}
            />
          </div>

          {message ? (
            <div
              className={`mt-4 rounded-md px-4 py-3 text-sm font-black ${
                message.tone === 'success'
                  ? 'bg-[#ecf8ef] text-[#2f7d3b]'
                  : 'bg-[#fff1ee] text-[#c9563f]'
              }`}
            >
              {message.text}
            </div>
          ) : null}
        </section>
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto grid min-h-[calc(5.75rem+env(safe-area-inset-bottom))] w-full max-w-md grid-cols-3 bg-[#626260] pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-10px_28px_rgba(15,23,42,0.16)]">
          <Link href={editHref} className="flex flex-col items-center justify-center gap-1.5 text-sm font-black text-white/90 active:bg-white/10">
            <EditIcon />
            <span>編輯</span>
          </Link>
          <Link href={copyHref} className="flex flex-col items-center justify-center gap-1.5 text-sm font-black text-white/90 active:bg-white/10">
            <CopyIcon />
            <span>複製</span>
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex flex-col items-center justify-center gap-1.5 text-sm font-black text-white/90 transition active:bg-white/10 disabled:text-white/45"
          >
            <TrashIcon />
            <span>{deleting ? '刪除中' : '刪除'}</span>
          </button>
        </div>
      </footer>
    </main>
  )
}

function RowShell({
  label,
  pending,
  children,
}: {
  label: string
  pending: boolean
  children: ReactNode
}) {
  return (
    <div className="grid min-h-[4.25rem] grid-cols-[4.8rem_minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-[#ececea] last:border-b-0">
      <label className="text-[1rem] font-black text-[#202124]">{label}</label>
      <div className="min-w-0">{children}</div>
      <div className="flex items-center justify-end">
        {pending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d8d8d4] border-t-[#626260]" aria-label="儲存中" />
        ) : (
          <FieldIcon label={label} />
        )}
      </div>
    </div>
  )
}

function SelectRow({
  label,
  value,
  options,
  pending,
  onChange,
}: {
  label: string
  value: string
  options: DetailAccount[]
  pending: boolean
  onChange: (value: string) => void
}) {
  return (
    <RowShell label={label} pending={pending}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full truncate bg-transparent py-3 text-right text-[1rem] font-black text-[#d86b6b] outline-none"
      >
        <option value="">選擇帳戶</option>
        {options.map((account) => (
          <option key={account.id} value={account.id}>
            {accountOptionLabel(account)}
          </option>
        ))}
      </select>
    </RowShell>
  )
}

function InputRow({
  label,
  value,
  optionsId,
  pending,
  onChange,
  onBlur,
}: {
  label: string
  value: string
  optionsId: string
  pending: boolean
  onChange: (value: string) => void
  onBlur: () => void
}) {
  return (
    <RowShell label={label} pending={pending}>
      <input
        value={value}
        list={optionsId}
        placeholder="未設定"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="w-full bg-transparent py-3 text-right text-[1rem] font-black text-[#d86b6b] outline-none placeholder:text-[#c5c7ca]"
      />
    </RowShell>
  )
}

function FrequencyRow({
  value,
  disabled,
  pending,
  onChange,
}: {
  value: RecurringSelection
  disabled: boolean
  pending: boolean
  onChange: (value: RecurringSelection) => void
}) {
  return (
    <RowShell label="週期" pending={pending}>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as RecurringSelection)}
        className="w-full bg-transparent py-3 text-right text-[1rem] font-black text-[#d86b6b] outline-none disabled:text-[#a4a7aa]"
      >
        {(Object.keys(FREQUENCY_LABELS) as RecurringSelection[]).map((item) => (
          <option key={item} value={item}>
            {disabled && item === 'none' ? '週期暫時不能改' : FREQUENCY_LABELS[item]}
          </option>
        ))}
      </select>
    </RowShell>
  )
}

function NoteRow({
  value,
  pending,
  onChange,
  onBlur,
}: {
  value: string
  pending: boolean
  onChange: (value: string) => void
  onBlur: () => void
}) {
  return (
    <RowShell label="備註" pending={pending}>
      <textarea
        value={value}
        rows={2}
        placeholder="未設定"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="min-h-[3.5rem] w-full resize-none bg-transparent py-3 text-right text-[1rem] font-black leading-6 text-[#d86b6b] outline-none placeholder:text-[#c5c7ca]"
      />
    </RowShell>
  )
}
