'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  archiveMerchantGroup,
  createMerchantGroup,
  createMerchant,
  renameMerchantGroup,
  updateMerchantGroup,
  updateMerchant,
} from '@/app/actions/merchant-groups'
import { createMaintenanceReminder } from '@/app/actions/reminders'
import { createRecurringTransaction } from '@/app/actions/recurring'
import { createTransaction, deleteTransaction, updateTransaction } from '@/app/actions/transactions'
import {
  buildCategoryPickerGroups,
  buildMerchantPickerGroups,
  UNASSIGNED_MERCHANT_GROUP_ID,
  type CategoryPickerGroup,
  type FamilyCategory,
  type FamilyMerchant,
  type FamilyMerchantGroup,
  type FamilyTransaction,
  type RecentAccountIdsByKind,
  type TransactionKind,
  type TransactionFormPreset,
} from '@/lib/family-transactions'
import {
  type TwdRateTable,
} from '@/lib/exchange-rates'
import { getCategoryDisplayIcon } from '@/lib/category-icons'
import { CategoryIcon } from '@/components/CategoryIcon'
import { normalizeOwner } from '@/lib/finance/types'
import type { FamilyAccount } from '@/lib/finance/types'

type Kind = 'expense' | 'income' | 'transfer' | 'reminder'

const KINDS: Kind[] = ['expense', 'income', 'transfer', 'reminder']

const KIND_LABELS: Record<Kind, string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
  reminder: '提辦',
}

const CURRENCIES = ['TWD', 'USD', 'JPY'] as const
const OWNERS = ['Oscar', 'Livia'] as const
const REMINDER_FREQUENCIES = ['once', 'weekly', 'monthly', 'quarterly', 'yearly'] as const
const REMINDER_FREQUENCY_LABELS: Record<(typeof REMINDER_FREQUENCIES)[number], string> = {
  once: '一次',
  weekly: '每週',
  monthly: '每月',
  quarterly: '每三個月',
  yearly: '每年',
}
const REMINDER_CATEGORIES = ['車子', '房屋', '帳單', '家事', '其他'] as const
type ReminderCategory = (typeof REMINDER_CATEGORIES)[number]
const KEYPAD_KEYS = [
  '7', '8', '9', '-',
  '4', '5', '6', '+',
  '1', '2', '3', 'confirm',
  '.', '0', 'clear', 'confirm',
] as const
const FORM_PADDING_WITH_KEYPAD = 'pb-[calc(26rem+env(safe-area-inset-bottom))]'
const FORM_PADDING_WITHOUT_KEYPAD = 'pb-[calc(10rem+env(safe-area-inset-bottom))]'
const KEYPAD_FOOTER_BOTTOM_OFFSET = 'calc(6.5rem + 2 * env(safe-area-inset-bottom))'
const ACTION_FOOTER_BOTTOM_OFFSET = 'calc(5.75rem + env(safe-area-inset-bottom))'

type Currency = (typeof CURRENCIES)[number]
type Owner = (typeof OWNERS)[number]
type ReminderFrequency = (typeof REMINDER_FREQUENCIES)[number]
type KeypadKey = (typeof KEYPAD_KEYS)[number]
type TransferAmountSide = 'source' | 'target'

type SelectOption = {
  value: string
  label: string
}

type SelectOptionGroup = {
  label: string
  options: SelectOption[]
}

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'kind' | 'balance' | 'owner' | 'shared' | 'type' | 'favorite'>[]
  categories: FamilyCategory[]
  merchants: FamilyMerchant[]
  merchantGroups: FamilyMerchantGroup[]
  initialPreset: TransactionFormPreset | null
  rateTable?: TwdRateTable | null
  mode?: 'create' | 'edit'
  transaction?: FamilyTransaction | null
  returnUrl?: string
  initialKind?: Kind
  recentAccountIdsByKind?: RecentAccountIdsByKind
}

function currentLocalDateTimeValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function currentLocalDateValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function toLocalDateTimeValue(value: string | null | undefined) {
  if (!value) return currentLocalDateTimeValue()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return currentLocalDateTimeValue()

  const offset = parsed.getTimezoneOffset()
  return new Date(parsed.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function ledgerHrefForOccurredAt(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-/)
  if (!match) return '/ledger'

  return `/ledger?year=${match[1]}&month=${Number(match[2])}`
}

function isCurrency(value: string | null | undefined): value is Currency {
  return value != null && CURRENCIES.includes(value as Currency)
}

function isOwner(value: string | null | undefined): value is Owner {
  return value != null && OWNERS.includes(value as Owner)
}

function formatAccountLabel(account: Pick<FamilyAccount, 'name' | 'currency'>) {
  return `${account.name} (${account.currency})`
}

function getAccountGroupLabel(account: Pick<FamilyAccount, 'owner' | 'shared'>) {
  if (account.shared) return '共通帳戶'

  const owner = normalizeOwner(account.owner)
  return owner === 'Livia' ? 'Livia' : 'Oscar'
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('button,a,input,select,textarea,label,[role="button"]'))
}

function buildAccountOptions(
  accounts: Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'owner' | 'shared' | 'favorite'>[],
) {
  const grouped = new Map<string, SelectOption[]>()
  const groupOrder = ['共通帳戶', 'Oscar', 'Livia']

  for (const account of accounts) {
    const label = getAccountGroupLabel(account)
    const options = grouped.get(label) ?? []
    options.push({
      value: account.id,
      label: account.favorite ? `${formatAccountLabel(account)} ★` : formatAccountLabel(account),
    })
    grouped.set(label, options)
  }

  return groupOrder
    .map((label) => {
      const options = grouped.get(label)
      if (!options?.length) return null
      return { label, options }
    })
    .filter((group): group is SelectOptionGroup => Boolean(group))
}

function pageKindToDbKind(kind: Kind): TransactionKind {
  return kind === 'reminder' ? 'expense' : (kind as TransactionKind)
}

function selectFrequentAccountIds(
  pageKind: Kind,
  recentByKind: RecentAccountIdsByKind | undefined,
  accounts: Pick<FamilyAccount, 'id' | 'favorite'>[],
  limit = 5,
): string[] {
  const dbKind = pageKindToDbKind(pageKind)
  const recent = recentByKind?.[dbKind] ?? []
  const favoriteIds = accounts.filter((account) => account.favorite).map((account) => account.id)
  const validIds = new Set(accounts.map((account) => account.id))
  const merged: string[] = []
  for (const id of [...recent, ...favoriteIds]) {
    if (!validIds.has(id)) continue
    if (merged.includes(id)) continue
    merged.push(id)
    if (merged.length >= limit) break
  }
  return merged
}

function amountAccentClass(kind: Kind) {
  if (kind === 'reminder') return 'text-[#4f8d7c]'
  if (kind === 'income') return 'text-[#2aa566]'
  if (kind === 'transfer') return 'text-slate-950'
  return 'text-[#17b79c]'
}

function amountDisplayClass(kind: Kind) {
  if (kind === 'reminder') {
    return 'text-[2.25rem] leading-none tracking-[-0.06em] sm:text-[2.6rem]'
  }
  if (kind === 'transfer') {
    return 'text-[3.55rem] leading-none tracking-[-0.06em] sm:text-[4rem]'
  }

  return 'text-[3.55rem] leading-none tracking-[-0.06em] sm:text-[4rem]'
}

function amountLineClass(kind: Kind) {
  if (kind === 'reminder') return 'bg-[#4f8d7c]'
  if (kind === 'income') return 'bg-[#2aa566]'
  if (kind === 'transfer') return 'bg-[#f2b232]'
  return 'bg-[#17b79c]'
}

function keypadShortcutActiveClass(kind: Kind) {
  if (kind === 'reminder') return 'bg-[#edf8f4] text-[#356f5f] shadow-[0_14px_28px_rgba(79,141,124,0.14)]'
  if (kind === 'income') return 'bg-[#fff2ec] text-[#d85d28] shadow-[0_14px_28px_rgba(216,93,40,0.14)]'
  if (kind === 'transfer') return 'bg-[#fff2df] text-[#d18c11] shadow-[0_14px_28px_rgba(242,178,50,0.18)]'
  return 'bg-[#ecfdf8] text-[#15957d] shadow-[0_14px_28px_rgba(21,149,125,0.14)]'
}

function evaluateAmount(amount: string): number {
  if (!amount) return 0
  const tokens = amount.split(/([+-])/).filter((t) => t !== '' && t !== '.')
  let total = 0
  let op = '+'
  for (const token of tokens) {
    if (token === '+' || token === '-') {
      op = token
    } else {
      const n = Number(token)
      if (Number.isFinite(n)) total = op === '+' ? total + n : total - n
    }
  }
  return total
}

function formatAmountDisplay(amount: string) {
  if (!amount) return '0.00'

  if (/[+-]/.test(amount)) {
    return evaluateAmount(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const [rawInteger = '0', rawDecimal = ''] = amount.split('.')
  const normalizedInteger = rawInteger.replace(/^0+(?=\d)/, '') || '0'
  const formattedInteger = Number(normalizedInteger).toLocaleString('en-US')

  if (!amount.includes('.')) return `${formattedInteger}.00`
  return `${formattedInteger}.${rawDecimal.padEnd(2, '0').slice(0, 2)}`
}

function parseAmount(amount: string) {
  return evaluateAmount(amount)
}

function appendAmountInput(current: string, value: string) {
  if (value === '+' || value === '-') {
    if (!current) return current
    if (current.endsWith('+') || current.endsWith('-')) {
      if (current.slice(-1) === value) return current.slice(0, -1)
      return `${current.slice(0, -1)}${value}`
    }
    if (current.endsWith('.')) return current
    return `${current}${value}`
  }

  if (value === '.') {
    const tokens = current.split(/[+-]/)
    const lastOperand = tokens[tokens.length - 1] ?? ''
    if (lastOperand.includes('.')) return current
    if (!current || current.endsWith('+') || current.endsWith('-')) return `${current}0.`
    return `${current}.`
  }

  const tokens = current.split(/([+-])/)
  const lastOperand = tokens[tokens.length - 1] ?? ''
  if (lastOperand === '0') {
    tokens[tokens.length - 1] = value
    return tokens.join('')
  }

  const nextLast = `${lastOperand}${value}`
  const [integer, decimal = ''] = nextLast.split('.')
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '') || '0'
  if (decimal.length > 2) return current

  tokens[tokens.length - 1] = nextLast.includes('.')
    ? `${normalizedInteger}.${decimal}`
    : normalizedInteger
  return tokens.join('')
}


function formatOccurredAtLabel(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '選擇時間'

  const now = new Date()
  const sameDay = parsed.toDateString() === now.toDateString()
  const dateLabel = `${parsed.getMonth() + 1}月${parsed.getDate()}日`
  const timeLabel = parsed.toLocaleTimeString('zh-TW', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return sameDay ? `今天 ${dateLabel} ${timeLabel}` : `${dateLabel} ${timeLabel}`
}

function accountFieldLabel(kind: Kind) {
  if (kind === 'reminder') return '關聯帳戶'
  if (kind === 'income') return '入帳帳戶'
  return '帳戶'
}

function accountFieldPlaceholder(kind: Kind) {
  if (kind === 'reminder') return '選擇房屋或汽車帳戶'
  if (kind === 'income') return '選擇入帳帳戶'
  return '選擇付款帳戶'
}

function formatReminderDueLabel(value: string) {
  if (!value) return '選擇日期'

  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return '選擇日期'

  const now = new Date()
  const sameDay = parsed.toDateString() === now.toDateString()
  const dateLabel = `${parsed.getFullYear()} / ${parsed.getMonth() + 1} / ${parsed.getDate()}`

  return sameDay ? `今天 · ${dateLabel}` : dateLabel
}

function resolveCategorySelection(
  groups: CategoryPickerGroup[],
  requestedCategoryId: string | null | undefined,
) {
  if (requestedCategoryId) {
    for (const group of groups) {
      if (group.children.some((child) => child.id === requestedCategoryId)) {
        return { parentId: group.parent.id, categoryId: requestedCategoryId }
      }

      if (group.parent.id === requestedCategoryId) {
        return {
          parentId: group.parent.id,
          categoryId: group.children[0]?.id ?? group.parent.id,
        }
      }
    }
  }

  const firstGroup = groups[0]
  if (!firstGroup) {
    return { parentId: '', categoryId: '' }
  }

  return {
    parentId: firstGroup.parent.id,
    categoryId: firstGroup.children[0]?.id ?? firstGroup.parent.id,
  }
}

function FieldLabel({
  tone,
  label,
}: {
  tone: string
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      <span className="text-[15px] font-bold text-slate-500">{label}</span>
    </div>
  )
}

function SelectFieldRow({
  tone,
  label,
  value,
  selectedValue,
  onChange,
  options,
}: {
  tone: string
  label: string
  value: string
  selectedValue: string
  onChange: (value: string) => void
  options: Array<SelectOption | SelectOptionGroup>
}) {
  return (
    <label className="relative flex min-h-[2.8rem] items-center justify-between gap-4 px-5">
      <FieldLabel tone={tone} label={label} />
      <div className="flex min-w-0 items-center gap-3">
        <span className={`truncate text-right text-[1.05rem] font-black ${selectedValue ? 'text-slate-950' : 'text-slate-400'}`}>
          {value}
        </span>
        <span className="text-lg text-slate-300">›</span>
      </div>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      >
        {options.map((option) =>
          'options' in option ? (
            <optgroup key={option.label} label={option.label}>
              {option.options.map((groupedOption) => (
                <option key={groupedOption.value || '__empty'} value={groupedOption.value}>
                  {groupedOption.label}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={option.value || '__empty'} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  )
}

function AccountChipRow({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'favorite'>[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (accounts.length < 2) return null
  return (
    <div className="flex flex-wrap gap-1.5 px-5 pb-2 pt-2">
      {accounts.map((account) => {
        const active = selectedId === account.id
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onSelect(account.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              active
                ? 'bg-[#f0b542] text-white shadow-[0_4px_10px_rgba(240,181,66,0.35)]'
                : 'bg-[#fff5dc] text-[#a86a07] hover:bg-[#ffeec5]'
            }`}
          >
            {account.name}
            {account.favorite ? ' ★' : ''}
          </button>
        )
      })}
    </div>
  )
}

function ShowAllAccountsToggle({
  showAll,
  onToggle,
}: {
  showAll: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex justify-end px-5 pb-1 pt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="text-[0.72rem] font-black text-slate-400 hover:text-slate-600"
      >
        {showAll ? '只顯示常用 ▴' : '顯示全部帳戶 ▾'}
      </button>
    </div>
  )
}

function DateFieldRow({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="relative flex min-h-[2.8rem] items-center justify-between gap-4 px-5">
      <FieldLabel tone="bg-[#ff8a73]" label="時間" />
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-right text-[1.05rem] font-black text-slate-950">
          {formatOccurredAtLabel(value)}
        </span>
        <span className="text-lg text-slate-300">›</span>
      </div>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="交易時間"
      />
    </label>
  )
}

function OwnerFieldRow({
  owner,
  onChange,
}: {
  owner: Owner
  onChange: (owner: Owner) => void
}) {
  return (
    <div className="flex min-h-[2.8rem] items-center justify-between gap-4 px-5">
      <FieldLabel tone="bg-[#ff6ea9]" label="成員" />
      <div className="flex items-center gap-2">
        {OWNERS.map((member) => (
          <button
            key={member}
            type="button"
            onClick={() => onChange(member)}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${
              owner === member
                ? 'bg-slate-950 text-white shadow-[0_8px_20px_rgba(15,23,42,0.16)]'
                : 'bg-[#f6f2eb] text-slate-500'
            }`}
          >
            {member === 'Oscar' ? '老公' : '老婆'}
          </button>
        ))}
      </div>
    </div>
  )
}

function TextFieldRow({
  tone,
  label,
  placeholder,
  value,
  onChange,
}: {
  tone: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-h-[2.8rem] items-center justify-between gap-4 px-5">
      <FieldLabel tone={tone} label={label} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-right text-[1.05rem] font-black text-slate-950 outline-none placeholder:font-bold placeholder:text-slate-300"
        aria-label={label}
      />
    </div>
  )
}

function TransferAccountRow({
  label,
  value,
  selectedValue,
  onChange,
  options,
}: {
  label: string
  value: string
  selectedValue: string
  onChange: (value: string) => void
  options: Array<SelectOption | SelectOptionGroup>
}) {
  const valueRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = valueRef.current
    if (!el) return
    const maxRem = 1.05
    const minRem = 0.68
    const step = 0.02
    const fit = () => {
      el.style.fontSize = `${maxRem}rem`
      let cur = maxRem
      while (el.scrollWidth > el.clientWidth && cur > minRem) {
        cur = Math.max(minRem, Number((cur - step).toFixed(2)))
        el.style.fontSize = `${cur}rem`
      }
    }
    fit()
    const obs = new ResizeObserver(() => requestAnimationFrame(fit))
    obs.observe(el)
    if (el.parentElement) obs.observe(el.parentElement)
    return () => obs.disconnect()
  }, [value])

  return (
    <label className="relative flex min-h-[2.8rem] items-center justify-between gap-4 px-5">
      <FieldLabel tone="bg-[#f0b542]" label={label} />
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span
          ref={valueRef}
          className={`block min-w-0 whitespace-nowrap font-black ${
            selectedValue ? 'text-slate-950' : 'text-slate-400'
          }`}
          style={{ fontSize: '1.05rem' }}
        >
          {value}
        </span>
        <span className="shrink-0 text-lg text-slate-300">›</span>
      </div>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      >
        {options.map((option) =>
          'options' in option ? (
            <optgroup key={option.label} label={option.label}>
              {option.options.map((groupedOption) => (
                <option key={groupedOption.value || '__empty'} value={groupedOption.value}>
                  {groupedOption.label}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={option.value || '__empty'} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  )
}

function TransferAmountPairRow({
  sourceAmount,
  sourceCurrency,
  targetAmount,
  targetCurrency,
  activeSide,
  onSourceOpen,
  onTargetOpen,
}: {
  sourceAmount: string
  sourceCurrency: string
  targetAmount: string
  targetCurrency: string
  activeSide: TransferAmountSide
  onSourceOpen: () => void
  onTargetOpen: () => void
}) {
  const sourceActive = activeSide === 'source'
  const targetActive = activeSide === 'target'

  function amountCellClass(isActive: boolean) {
    return `min-w-0 flex-1 rounded-[1.2rem] border px-4 py-3 text-left transition ${
      isActive
        ? 'border-[#f0c44f] bg-[#fff8cf] shadow-[0_10px_22px_rgba(242,178,50,0.14)]'
        : 'border-[#ece4d8] bg-white'
    }`
  }

  function amountTextClass(isActive: boolean) {
    return `block truncate text-[1.4rem] font-black leading-none tracking-[-0.06em] sm:text-[1.6rem] ${
      isActive ? 'text-[#d28a10]' : 'text-slate-950'
    }`
  }

  return (
    <div className="rounded-[1.6rem] border border-[#ece4d8] bg-[#fcfbf8] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] items-stretch gap-2">
        <button
          type="button"
          onClick={onSourceOpen}
          className={amountCellClass(sourceActive)}
          aria-label={`編輯轉出金額，${sourceCurrency}`}
        >
          <div className="text-[0.64rem] font-black tracking-[0.16em] text-slate-400">
            {sourceCurrency}
          </div>
          <span className={amountTextClass(sourceActive)}>{formatAmountDisplay(sourceAmount)}</span>
        </button>

        <div className="flex items-center justify-center text-xl font-black text-slate-300" aria-hidden="true">
          ›
        </div>

        <button
          type="button"
          onClick={onTargetOpen}
          className={amountCellClass(targetActive)}
          aria-label={`編輯轉入金額，${targetCurrency}`}
        >
          <div className="text-[0.64rem] font-black tracking-[0.16em] text-slate-400">
            {targetCurrency}
          </div>
          <span className={amountTextClass(targetActive)}>{formatAmountDisplay(targetAmount)}</span>
        </button>
      </div>
    </div>
  )
}

function ReminderDueDateRow({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="relative flex min-h-[2.9rem] items-center justify-between gap-4 px-5">
      <div className="flex items-center gap-3">
        <span className="text-[0.68rem] font-black tracking-[0.16em] text-[#7b9e91]">下次提醒</span>
      </div>
      <span className={`truncate text-right text-[1rem] font-black ${value ? 'text-slate-950' : 'text-slate-400'}`}>
        {formatReminderDueLabel(value)}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="下次提醒日期"
      />
    </label>
  )
}

function CategoryFieldRow({
  value,
  onOpen,
}: {
  value: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[2.9rem] w-full items-center justify-between gap-4 px-5 text-left"
    >
      <FieldLabel tone="bg-[#ff78a6]" label="分類" />
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 text-right">
          <div className="truncate text-[1rem] font-black text-slate-900">{value.replace('›', '>')}</div>
        </div>
        <span className="text-lg text-slate-300">›</span>
      </div>
    </button>
  )
}

function CategoryPickerSheet({
  open,
  categories,
  kind,
  selectedParentId,
  selectedCategoryId,
  onParentChange,
  onCategoryChange,
  onOpenSettings,
  onClose,
}: {
  open: boolean
  categories: FamilyCategory[]
  kind: TransactionKind
  selectedParentId: string
  selectedCategoryId: string
  onParentChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onOpenSettings: () => void
  onClose: () => void
}) {
  const groups = buildCategoryPickerGroups(categories, kind)
  const initialParentId =
    groups.find((group) => group.parent.id === selectedParentId)?.parent.id ??
    groups[0]?.parent.id ??
    ''
  const [activeParentId, setActiveParentId] = useState(initialParentId)

  useEffect(() => {
    if (!open) return
    const next =
      groups.find((group) => group.parent.id === selectedParentId)?.parent.id ??
      groups[0]?.parent.id ??
      ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveParentId(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const activeGroup = groups.find((group) => group.parent.id === activeParentId) ?? groups[0] ?? null
  const children = activeGroup?.children ?? []

  if (typeof document === 'undefined') return null

  function handlePickChild(childId: string) {
    if (activeGroup && activeGroup.parent.id !== selectedParentId) {
      onParentChange(activeGroup.parent.id)
    }
    onCategoryChange(childId)
    onClose()
  }

  function handlePickParentWithoutChildren(parentId: string) {
    onParentChange(parentId)
    onCategoryChange(parentId)
    onClose()
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(15,23,42,0.32)] transition ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label="關閉分類選擇"
      />
      <div
        className={`absolute inset-x-0 bottom-0 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="relative z-10 mx-auto w-full max-w-md rounded-t-[1.8rem] bg-white pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-24px_60px_rgba(15,23,42,0.18)]">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 pt-3">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
              aria-label="新增/管理分類"
              title="新增/管理分類"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="2" stroke="currentColor">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
              aria-label="關閉"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="2" stroke="currentColor">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm font-bold text-slate-400">
              還沒有 {KIND_LABELS[kind]} 分類，點左上「+」新增
            </div>
          ) : (
            <div className="mt-2 flex" style={{ height: '60vh', maxHeight: '480px' }}>
              {/* Left: parent list */}
              <div className="w-[108px] shrink-0 overflow-y-auto bg-[#f5f5f7]">
                {groups.map((group) => {
                  const isActive = group.parent.id === activeParentId
                  return (
                    <button
                      key={group.parent.id}
                      type="button"
                      onClick={() => setActiveParentId(group.parent.id)}
                      className={`flex w-full items-center justify-center px-2 py-3 text-[15px] transition ${
                        isActive
                          ? 'bg-white font-black text-slate-900'
                          : 'font-bold text-slate-500'
                      }`}
                    >
                      <span className="truncate">{group.parent.name}</span>
                    </button>
                  )
                })}
              </div>

              {/* Right: child grid */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {activeGroup && (
                  <>
                    <div className="px-1 py-2 text-[13px] font-bold text-slate-400">
                      {activeGroup.parent.name}
                    </div>
                    {children.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => handlePickParentWithoutChildren(activeGroup.parent.id)}
                        className={`mt-2 flex w-full flex-col items-center gap-1 rounded-[1rem] px-2 py-3 transition ${
                          selectedCategoryId === activeGroup.parent.id
                            ? 'bg-[#fff1e3]'
                            : 'active:bg-slate-50'
                        }`}
                      >
                        <CategoryIcon icon={getCategoryDisplayIcon(activeGroup.parent)} size={52} />
                        <span className="text-[12px] font-bold text-slate-700">
                          {activeGroup.parent.name}
                        </span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-4 gap-1">
                        {children.map((child) => {
                          const isSelected = child.id === selectedCategoryId
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handlePickChild(child.id)}
                              className={`flex flex-col items-center gap-1 rounded-[1rem] px-1 py-3 transition ${
                                isSelected ? 'bg-[#fff1e3]' : 'active:bg-slate-50'
                              }`}
                            >
                              <CategoryIcon icon={getCategoryDisplayIcon(child)} size={52} />
                              <span className="line-clamp-1 text-[12px] font-bold text-slate-700">
                                {child.name}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function MerchantFieldRow({
  value,
  onOpen,
}: {
  value: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[2.8rem] w-full items-center justify-between gap-4 px-5 text-left"
    >
      <FieldLabel tone="bg-[#53d8bf]" label="商家" />
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 text-right">
          <div className={`truncate text-[1rem] font-black ${value ? 'text-slate-900' : 'text-slate-400'}`}>
            {value || '選擇商家'}
          </div>
        </div>
        <span className="text-lg text-slate-300">›</span>
      </div>
    </button>
  )
}

function MerchantPickerSheet({
  open,
  merchants,
  merchantGroups,
  value,
  onChange,
  onOpenSettings,
  onClose,
}: {
  open: boolean
  merchants: FamilyMerchant[]
  merchantGroups: FamilyMerchantGroup[]
  value: string
  onChange: (value: string) => void
  onOpenSettings: () => void
  onClose: () => void
}) {
  const merchantPickerGroups = useMemo(
    () => buildMerchantPickerGroups(merchants, merchantGroups),
    [merchants, merchantGroups],
  )
  const [draftValue, setDraftValue] = useState(value)
  const normalizedValue = draftValue.trim()
  const normalizedLower = normalizedValue.toLocaleLowerCase('zh-TW')
  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.name.trim().toLocaleLowerCase('zh-TW') === normalizedLower) ?? null,
    [merchants, normalizedLower],
  )
  const selectedMerchantGroupId = selectedMerchant?.group_id ?? UNASSIGNED_MERCHANT_GROUP_ID
  const [selectedGroupId, setSelectedGroupId] = useState(() => (
    selectedMerchant ? selectedMerchantGroupId : 'recent'
  ))
  const resolvedGroupId = merchantPickerGroups.some((group) => group.id === selectedGroupId)
    ? selectedGroupId
    : selectedMerchant ? selectedMerchantGroupId : merchantPickerGroups[0]?.id ?? 'recent'
  const selectedGroup = merchantPickerGroups.find((group) => group.id === resolvedGroupId) ?? merchantPickerGroups[0] ?? null
  const selectedMerchantName = selectedMerchant?.name.trim().toLocaleLowerCase('zh-TW') ?? ''
  const shouldFilterMerchants = normalizedLower.length > 0 && normalizedLower !== selectedMerchantName
  const visibleMerchants = shouldFilterMerchants
    ? [...merchants]
        .filter((merchant) => merchant.name.toLocaleLowerCase('zh-TW').includes(normalizedLower))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
    : selectedGroup?.merchants ?? []
  const canUseTypedValue = normalizedValue.length > 0 && !selectedMerchant

  function handlePickMerchant(name: string) {
    onChange(name.trim())
    onClose()
  }

  function handleComplete() {
    onChange(draftValue.trim())
    onClose()
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(15,23,42,0.28)] transition ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label="關閉商家選擇"
      />
      <div
        className={`absolute inset-x-0 bottom-0 z-10 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-md rounded-t-[2.2rem] bg-[#faf7f0] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_60px_rgba(15,23,42,0.2)]">
          <div className="relative flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition active:scale-[0.97]"
              aria-label="商家分類設定"
              title="商家分類設定"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path
                  d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M19.08 13.58c.06-.5.06-1.03 0-1.58l1.57-1.21-1.5-2.6-1.86.75a7.3 7.3 0 0 0-1.36-.78l-.28-1.98h-3l-.28 1.98c-.5.2-.96.46-1.38.78l-1.84-.75-1.5 2.6L8.92 12a7.5 7.5 0 0 0 0 1.58l-1.57 1.21 1.5 2.6 1.84-.75c.43.32.89.58 1.38.78l.28 1.98h3l.28-1.98c.49-.2.95-.46 1.36-.78l1.86.75 1.5-2.6-1.57-1.21Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="absolute left-1/2 top-1/2 h-1.5 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200" />
            <button
              type="button"
              onClick={handleComplete}
              className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-500 shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
            >
              完成
            </button>
          </div>

          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-full bg-[#f3f3f2] px-4">
            <span className="text-lg text-slate-400" aria-hidden="true">⌕</span>
            <input
              type="text"
              value={draftValue}
              onChange={(event) => {
                setDraftValue(event.target.value)
              }}
              placeholder="搜尋或輸入商家"
              className="ios-search-input min-w-0 flex-1 bg-transparent text-center font-black text-slate-700 outline-none placeholder:text-slate-400"
              aria-label="商家"
            />
            {draftValue ? (
              <button
                type="button"
                onClick={() => setDraftValue('')}
                aria-label="清除商家搜尋"
                className="flex h-6 w-6 items-center justify-center rounded-full text-base text-[#a0a4a8] hover:bg-[#eeebe4] hover:text-[#3a3d42]"
              >
                ×
              </button>
            ) : null}
          </label>

          {merchantPickerGroups.length === 0 ? (
            <div className="mt-4 rounded-[1.6rem] bg-white/90 px-4 py-10 text-center text-sm font-bold text-slate-400 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
              還沒有可用的商家
            </div>
          ) : (
            <div className="mt-4 flex overflow-hidden rounded-[1.6rem] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]" style={{ height: '60vh', maxHeight: '480px' }}>
              <div className="w-[108px] shrink-0 overflow-y-auto bg-[#f5f5f7]">
                {merchantPickerGroups.map((group) => {
                  const isActive = group.id === selectedGroup?.id
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`flex w-full items-center justify-center px-2 py-3 text-[15px] transition ${
                        isActive
                          ? 'bg-white font-black text-slate-900'
                          : 'font-bold text-slate-500'
                      }`}
                    >
                      <span className="truncate">{group.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-2">
                <div className="px-1 py-2 text-[13px] font-bold text-slate-400">
                  {selectedGroup?.label ?? '商家'}
                </div>
                {visibleMerchants.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1">
                    {visibleMerchants.map((merchant) => {
                      const isSelected = merchant.id === selectedMerchant?.id
                      return (
                        <button
                          key={merchant.id}
                          type="button"
                          onClick={() => handlePickMerchant(merchant.name)}
                          className={`flex min-h-[3.6rem] items-center justify-center rounded-[1rem] px-1 py-2 transition ${
                            isSelected ? 'bg-[#fff1e3]' : 'active:bg-slate-50'
                          }`}
                        >
                          <span className="line-clamp-2 text-center text-[12px] font-bold text-slate-700">
                            {merchant.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-sm font-bold text-slate-400">
                    <div>這個分類沒有商家</div>
                    {canUseTypedValue ? (
                      <button
                        type="button"
                        onClick={() => handlePickMerchant(normalizedValue)}
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
                      >
                        使用「{normalizedValue}」
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function MerchantManagerSheet({
  open,
  groups,
  merchants,
  onGroupUpsert,
  onGroupArchive,
  onMerchantUpsert,
  onClose,
}: {
  open: boolean
  groups: FamilyMerchantGroup[]
  merchants: FamilyMerchant[]
  onGroupUpsert: (group: FamilyMerchantGroup) => void
  onGroupArchive: (groupId: string) => void
  onMerchantUpsert: (merchant: FamilyMerchant, previousName?: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [managerView, setManagerView] = useState<'merchants' | 'groups'>('merchants')
  const [rootName, setRootName] = useState('')
  const [newMerchantName, setNewMerchantName] = useState('')
  const [newMerchantGroupId, setNewMerchantGroupId] = useState(() => groups[0]?.id ?? '')
  const merchantNameInputRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null)
  const [editingMerchantName, setEditingMerchantName] = useState('')
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  function handleEnter(event: KeyboardEvent<HTMLInputElement>, action: () => void) {
    if (event.key !== 'Enter') return

    event.preventDefault()
    action()
  }

  const merchantGroupOptions = [
    { value: '', label: '未分類' },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
  ]

  const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW')

  const merchantCountByGroupId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const merchant of merchants) {
      if (!merchant.group_id) continue
      counts.set(merchant.group_id, (counts.get(merchant.group_id) ?? 0) + 1)
    }
    return counts
  }, [merchants])

  const merchantsByGroupId = useMemo(() => {
    const grouped = new Map<string, FamilyMerchant[]>()
    const unassigned: FamilyMerchant[] = []

    for (const merchant of merchants) {
      if (!merchant.group_id) {
        unassigned.push(merchant)
        continue
      }

      const existing = grouped.get(merchant.group_id) ?? []
      existing.push(merchant)
      grouped.set(merchant.group_id, existing)
    }

    for (const list of grouped.values()) {
      list.sort((a, b) => {
        if (a.last_used_at !== b.last_used_at) {
          return b.last_used_at.localeCompare(a.last_used_at)
        }

        return a.name.localeCompare(b.name, 'zh-TW')
      })
    }

    unassigned.sort((a, b) => {
      if (a.last_used_at !== b.last_used_at) {
        return b.last_used_at.localeCompare(a.last_used_at)
      }

      return a.name.localeCompare(b.name, 'zh-TW')
    })

    return { grouped, unassigned }
  }, [merchants])

  const unassignedMerchantCount = merchantsByGroupId.unassigned.length
  const recentMerchants = [...merchants]
    .sort((a, b) => {
      if (a.last_used_at !== b.last_used_at) {
        return b.last_used_at.localeCompare(a.last_used_at)
      }

      return a.name.localeCompare(b.name, 'zh-TW')
    })
    .slice(0, 5)

  const resolvedNewMerchantGroupId = useMemo(() => {
    if (newMerchantGroupId === '') return ''
    if (groups.some((group) => group.id === newMerchantGroupId)) return newMerchantGroupId
    return groups[0]?.id ?? ''
  }, [groups, newMerchantGroupId])

  const filteredGroups = normalizedQuery
    ? groups.filter((group) => {
        const groupMatches = group.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery)
        const merchantMatches = (merchantsByGroupId.grouped.get(group.id) ?? []).some((merchant) =>
          merchant.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
        )
        return groupMatches || merchantMatches
      })
    : groups

  const filteredUnassignedMerchants = normalizedQuery
    ? merchantsByGroupId.unassigned.filter((merchant) =>
        merchant.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
      )
    : merchantsByGroupId.unassigned

  async function handleCreate(name: string) {
    const normalizedName = name.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家分類名稱不能空白。' })
      return
    }

    setPendingKey('create-group')
    setNotice(null)

    try {
      const result = await createMerchantGroup(normalizedName)
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      onGroupUpsert(result.group)
      setRootName('')
      setNewMerchantGroupId(result.group.id)
      setNotice({ tone: 'success', text: '商家分類已新增。' })
    } finally {
      setPendingKey(null)
    }
  }

  async function handleCreateMerchant() {
    const normalizedName = newMerchantName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家名稱不能空白。' })
      return
    }

    setPendingKey('create-merchant')
    setNotice(null)

    try {
      const result = await createMerchant({
        name: normalizedName,
        groupId: resolvedNewMerchantGroupId || null,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      onMerchantUpsert(result.merchant)
      setNewMerchantName('')
      setNotice({ tone: 'success', text: '商家已新增並分類。' })
    } finally {
      setPendingKey(null)
    }
  }

  async function handleRename() {
    if (!editingId) return

    const normalizedName = editingName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家分類名稱不能空白。' })
      return
    }

    setPendingKey(`rename-${editingId}`)
    setNotice(null)

    try {
      const result = await renameMerchantGroup({ id: editingId, name: normalizedName })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      onGroupUpsert(result.group)
      setEditingId(null)
      setEditingName('')
      setNotice({ tone: 'success', text: '商家分類已更新。' })
    } finally {
      setPendingKey(null)
    }
  }

  async function handleArchive(groupId: string) {
    if (!window.confirm('封存這個商家分類？分類裡的商家會回到未分類。')) return

    setPendingKey(`archive-${groupId}`)
    setNotice(null)

    try {
      const result = await archiveMerchantGroup(groupId)
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      onGroupArchive(groupId)
      setNotice({ tone: 'success', text: '商家分類已封存。' })
    } finally {
      setPendingKey(null)
    }
  }

  async function handleMerchantGroupChange(merchantId: string, nextGroupId: string) {
    setPendingKey(`merchant-${merchantId}`)
    setNotice(null)

    try {
      const result = await updateMerchantGroup({
        merchantId,
        groupId: nextGroupId === '__unassigned__' ? null : nextGroupId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      onMerchantUpsert(result.merchant)
      setNotice({ tone: 'success', text: '商家分類已更新。' })
    } finally {
      setPendingKey(null)
    }
  }

  async function handleMerchantRename() {
    if (!editingMerchantId) return

    const normalizedName = editingMerchantName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家名稱不能空白。' })
      return
    }

    const currentMerchant = merchants.find((item) => item.id === editingMerchantId) ?? null

    setPendingKey(`rename-merchant-${editingMerchantId}`)
    setNotice(null)

    try {
      const result = await updateMerchant({
        merchantId: editingMerchantId,
        name: normalizedName,
        groupId: currentMerchant?.group_id ?? null,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      onMerchantUpsert(result.merchant, currentMerchant?.name)
      setEditingMerchantId(null)
      setEditingMerchantName('')
      setNotice({ tone: 'success', text: '商家已更新。' })
    } finally {
      setPendingKey(null)
    }
  }

  const groupAssignmentOptions = [
    { value: '__unassigned__', label: '未分類' },
    ...groups.map((group) => ({ value: group.id, label: group.name })),
  ]

  function focusMerchantComposer(groupId?: string) {
    if (typeof groupId === 'string') {
      setNewMerchantGroupId(groupId)
    }
    requestAnimationFrame(() => {
      merchantNameInputRef.current?.focus()
    })
  }

  function renderMerchantRow(merchantItem: FamilyMerchant) {
    const isMerchantEditing = editingMerchantId === merchantItem.id
    const pendingMerchantKey = pendingKey === `rename-merchant-${merchantItem.id}`
    const merchantGroupName = merchantItem.group_id
      ? groups.find((group) => group.id === merchantItem.group_id)?.name ?? '未分類'
      : '未分類'

    return (
      <div
        key={merchantItem.id}
        className="rounded-md border border-[#eee6d9] bg-[#fcfbf8] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isMerchantEditing ? (
              <input
                type="text"
                value={editingMerchantName}
                onChange={(event) => setEditingMerchantName(event.target.value)}
                onKeyDown={(event) => handleEnter(event, handleMerchantRename)}
                className="w-full rounded-[1rem] border border-[#eadfce] bg-white px-3 py-2 text-sm font-black text-slate-950 outline-none"
                aria-label="商家名稱"
                autoFocus
              />
            ) : (
              <div className="truncate text-[0.98rem] font-black text-slate-900">{merchantItem.name}</div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#f4f1ea] px-2.5 py-1 text-[0.68rem] font-black text-slate-600">
                {merchantGroupName}
              </span>
              {merchantItem.last_used_at ? (
                <span className="text-xs font-bold text-slate-400">
                  最近使用 {merchantItem.last_used_at.slice(0, 10)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <select
            value={merchantItem.group_id ?? '__unassigned__'}
            onChange={(event) => handleMerchantGroupChange(merchantItem.id, event.target.value)}
            disabled={pendingKey === `merchant-${merchantItem.id}` || Boolean(pendingKey)}
            className="min-w-0 rounded-[0.95rem] border border-[#e7dccb] bg-white px-3 py-2.5 text-sm font-black text-slate-700 outline-none disabled:opacity-50"
            aria-label={`設定 ${merchantItem.name} 的商家分類`}
          >
            {groupAssignmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isMerchantEditing ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleMerchantRename}
                disabled={pendingMerchantKey || Boolean(pendingKey)}
                className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                儲存
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingMerchantId(null)
                  setEditingMerchantName('')
                }}
                disabled={Boolean(pendingKey)}
                className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 disabled:opacity-50"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startMerchantEditing(merchantItem)}
              disabled={Boolean(pendingKey)}
              className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
            >
              修改
            </button>
          )}
        </div>
      </div>
    )
  }

  function startEditing(group: FamilyMerchantGroup) {
    setEditingId(group.id)
    setEditingName(group.name)
    setNotice(null)
  }

  function startMerchantEditing(merchant: FamilyMerchant) {
    setEditingMerchantId(merchant.id)
    setEditingMerchantName(merchant.name)
    setNotice(null)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(15,23,42,0.34)] backdrop-blur-[2px] transition ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="關閉商家分類設定"
      />

      <div
        className={`absolute inset-x-0 bottom-0 top-4 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-t-[2.35rem] border border-white/70 bg-[#faf7f0] shadow-[0_-28px_70px_rgba(15,23,42,0.22)]">
          <header className="shrink-0 border-b border-[#eee5d8] bg-white px-4 pt-[calc(0.9rem+env(safe-area-inset-top))] pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f4f1ea] px-3 py-1 text-[0.68rem] font-black tracking-[0.18em] text-slate-600">
                商家設定
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-[#f4f1ea] p-2 text-2xl leading-none text-slate-600 transition active:scale-[0.96]"
                aria-label="關閉商家分類設定"
              >
                ×
              </button>
            </div>

            <div className="mt-4">
              <div className="text-[1.55rem] font-black leading-[1.05] tracking-[-0.04em] text-slate-950">
                管理商家與分類
              </div>
              <div className="mt-1 text-sm text-slate-500">
                先整理商家分類，再回去選商家。
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-[#eee5d8] bg-[#fcfbf8] px-3 py-3">
                <div className="text-[0.65rem] font-black tracking-[0.16em] text-slate-400">分類</div>
                <div className="mt-1 text-lg font-black text-slate-900">{groups.length}</div>
              </div>
              <div className="rounded-md border border-[#eee5d8] bg-[#fcfbf8] px-3 py-3">
                <div className="text-[0.65rem] font-black tracking-[0.16em] text-slate-400">商家</div>
                <div className="mt-1 text-lg font-black text-slate-900">{merchants.length}</div>
              </div>
              <div className="rounded-md border border-[#eee5d8] bg-[#fcfbf8] px-3 py-3">
                <div className="text-[0.65rem] font-black tracking-[0.16em] text-slate-400">未分類</div>
                <div className="mt-1 text-lg font-black text-slate-900">{unassignedMerchantCount}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-[1.25rem] bg-[#f4f1ea] p-1">
              {[
                { id: 'merchants' as const, label: '商家' },
                { id: 'groups' as const, label: '分類' },
              ].map((item) => {
                const isActive = managerView === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setManagerView(item.id)
                      setNotice(null)
                    }}
                    className={`rounded-[1rem] px-3 py-2 text-sm font-black transition ${
                      isActive
                        ? 'bg-white text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.08)]'
                        : 'text-slate-500'
                    }`}
                    aria-pressed={isActive}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </header>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-[#faf7f0] pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {notice ? (
              <div className="px-4 pt-4">
                <div
                  className={`rounded-[1.1rem] px-4 py-3 text-sm font-black shadow-[0_12px_24px_rgba(15,23,42,0.06)] ${
                    notice.tone === 'success'
                      ? 'bg-[#ebfff7] text-[#187d5f]'
                      : 'bg-[#fff3f2] text-[#c2413a]'
                  }`}
                >
                  {notice.text}
                </div>
              </div>
            ) : null}

            <div className="space-y-4 px-4 py-4">
              <section className="grid gap-3">
                {managerView === 'merchants' ? (
                <div className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between border-b border-[#f2ece2] px-4 py-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">快速新增商家</div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-400">
                        可以直接留在未分類，也可以先選好分類。
                      </div>
                    </div>
                    <span className="rounded-full bg-[#ecfdf8] px-2.5 py-1 text-[0.68rem] font-black text-[#15957d]">
                      Quick add
                    </span>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    <input
                      ref={merchantNameInputRef}
                      type="text"
                      value={newMerchantName}
                      onChange={(event) => setNewMerchantName(event.target.value)}
                      onKeyDown={(event) => handleEnter(event, handleCreateMerchant)}
                      placeholder="商家名稱"
                      className="ios-search-input w-full rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-3 text-sm font-black text-slate-950 outline-none placeholder:text-slate-400"
                      aria-label="新增商家名稱"
                    />
                    <div className="flex items-center gap-2">
                        <select
                        value={resolvedNewMerchantGroupId}
                        onChange={(event) => setNewMerchantGroupId(event.target.value)}
                        className="min-w-0 flex-1 rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-3 text-sm font-black text-slate-700 outline-none"
                        aria-label="新增商家分類"
                      >
                        {merchantGroupOptions.map((option) => (
                          <option key={option.value || '__empty'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCreateMerchant}
                        disabled={pendingKey === 'create-merchant'}
                        className="shrink-0 rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                      >
                        新增
                      </button>
                    </div>
                  </div>
                </div>
                ) : null}

                {managerView === 'groups' ? (
                <div className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between border-b border-[#f2ece2] px-4 py-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">快速新增分類</div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-400">
                        分類先建好，之後商家就能直接掛上去。
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    <input
                      type="text"
                      value={rootName}
                      onChange={(event) => setRootName(event.target.value)}
                      onKeyDown={(event) => handleEnter(event, () => handleCreate(rootName))}
                      placeholder="分類名稱"
                      className="ios-search-input w-full rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-3 text-sm font-black text-slate-950 outline-none placeholder:text-slate-400"
                      aria-label="新增商家分類"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreate(rootName)}
                      disabled={pendingKey === 'create-group'}
                      className="w-full rounded-[1rem] bg-[#f6d36a] px-4 py-3 text-sm font-black text-slate-950 shadow-[0_14px_28px_rgba(246,211,106,0.28)] disabled:opacity-50"
                    >
                      新增分類
                    </button>
                  </div>
                </div>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between border-b border-[#f2ece2] px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">搜尋</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-400">
                      找分類或商家，下面會直接縮成命中的內容。
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">
                      {filteredGroups.length + (filteredUnassignedMerchants.length > 0 ? 1 : 0)} 區塊
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-400">命中結果</div>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <label className="flex min-h-11 items-center gap-2 rounded-full bg-[#f3f3f2] px-4">
                    <span className="text-lg text-slate-400" aria-hidden="true">
                      ⌕
                    </span>
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜尋分類、商家"
                      className="ios-search-input min-w-0 flex-1 bg-transparent text-center font-black text-slate-700 outline-none placeholder:text-slate-400"
                      aria-label="快速搜尋商家分類"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="清除搜尋"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-base text-[#a0a4a8] hover:bg-[#eeebe4] hover:text-[#3a3d42]"
                      >
                        ×
                      </button>
                    ) : null}
                  </label>
                </div>
              </section>

              {managerView === 'merchants' && recentMerchants.length > 0 ? (
                <section className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between border-b border-[#f2ece2] px-4 py-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">最近使用</div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-400">點一下可直接帶回上方快速新增</div>
                    </div>
                  </div>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-4">
                    {recentMerchants.map((merchantItem) => (
                      <button
                        key={merchantItem.id}
                        type="button"
                        onClick={() => {
                          setNewMerchantName(merchantItem.name)
                          setNewMerchantGroupId(merchantItem.group_id ?? '')
                          setNotice(null)
                          focusMerchantComposer(merchantItem.group_id ?? undefined)
                        }}
                        className="shrink-0 rounded-full border border-[#eadfce] bg-[#fcfbf8] px-4 py-2 text-left text-sm font-black text-slate-700 transition active:scale-[0.98]"
                      >
                        {merchantItem.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {managerView === 'merchants' && (filteredUnassignedMerchants.length > 0 || (!normalizedQuery && unassignedMerchantCount > 0)) ? (
                <section className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between border-b border-[#f2ece2] px-4 py-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">未分類</div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-400">還沒分組的商家先放這裡</div>
                    </div>
                    <div className="rounded-full bg-[#f8f5ef] px-3 py-1 text-xs font-black text-slate-600">
                      {normalizedQuery ? filteredUnassignedMerchants.length : unassignedMerchantCount} 項
                    </div>
                  </div>
                  <div className="space-y-2 px-3 py-3">
                    {(normalizedQuery ? filteredUnassignedMerchants : merchantsByGroupId.unassigned).length > 0 ? (
                      (normalizedQuery ? filteredUnassignedMerchants : merchantsByGroupId.unassigned).map((merchantItem) =>
                        renderMerchantRow(merchantItem),
                      )
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-[#e3d9c6] bg-[#fcfbf8] px-4 py-8 text-center text-sm font-bold text-slate-400">
                        這裡目前沒有商家
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {filteredGroups.length > 0 ? (
                filteredGroups.map((group) => {
                  const isEditing = editingId === group.id
                  const isPending = pendingKey === `rename-${group.id}` || pendingKey === `archive-${group.id}`
                  const totalMerchantCount = merchantCountByGroupId.get(group.id) ?? 0
                  const allMerchantsInGroup = merchantsByGroupId.grouped.get(group.id) ?? []
                  const groupNameMatches = normalizedQuery
                    ? group.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery)
                    : false
                  const visibleMerchants = !normalizedQuery || groupNameMatches
                    ? allMerchantsInGroup
                    : allMerchantsInGroup.filter((merchantItem) =>
                        merchantItem.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
                      )

                  return (
                    <section key={group.id} className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                      <div className="flex items-start justify-between gap-3 border-b border-[#f2ece2] px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingName}
                                onChange={(event) => setEditingName(event.target.value)}
                                onKeyDown={(event) => handleEnter(event, handleRename)}
                                className="w-full rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-2 text-sm font-black text-slate-950 outline-none"
                                aria-label="商家分類名稱"
                                autoFocus
                              />
                            ) : (
                              group.name
                            )}
                          </div>
                          <div className="mt-0.5 text-xs font-semibold text-slate-400">
                            {group.name} · {visibleMerchants.length} / {totalMerchantCount} 個商家
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          {managerView === 'merchants' ? (
                            <button
                            type="button"
                            onClick={() => focusMerchantComposer(group.id)}
                            disabled={Boolean(pendingKey)}
                            className="rounded-full bg-[#ecfdf8] px-3 py-2 text-xs font-black text-[#187d5f] disabled:opacity-50"
                          >
                            新增到此分類
                          </button>
                          ) : null}
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={handleRename}
                                disabled={Boolean(pendingKey)}
                                className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                              >
                                儲存
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null)
                                  setEditingName('')
                                }}
                                disabled={Boolean(pendingKey)}
                                className="rounded-full bg-[#f4f1ea] px-3 py-2 text-xs font-black text-slate-500 disabled:opacity-50"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditing(group)}
                                disabled={Boolean(pendingKey)}
                                className="rounded-full bg-[#f4f1ea] px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
                              >
                                修改
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchive(group.id)}
                                disabled={isPending || Boolean(pendingKey)}
                                className="rounded-full bg-[#fff1ee] px-3 py-2 text-xs font-black text-[#c9563f] disabled:opacity-50"
                              >
                                封存
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {managerView === 'merchants' ? (
                      <div className="space-y-2 px-3 py-3">
                        {visibleMerchants.length > 0 ? (
                          visibleMerchants.map((merchantItem) => renderMerchantRow(merchantItem))
                        ) : (
                          <div className="rounded-[1.25rem] border border-dashed border-[#e3d9c6] bg-[#fcfbf8] px-4 py-8 text-center text-sm font-bold text-slate-400">
                            這個分類目前沒有符合搜尋的商家
                          </div>
                        )}
                      </div>
                      ) : null}
                    </section>
                  )
                })
              ) : (
                <div className="rounded-[1.7rem] border border-dashed border-[#e3d9c6] bg-white px-4 py-10 text-center text-sm font-bold text-slate-400">
                  沒有符合搜尋的分類
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#eee5d8] bg-[#faf7f0] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)] transition active:scale-[0.98]"
              aria-label="關閉商家設定"
            >
              完成並返回
            </button>
            </div>
          </div>
        </div>
    </div>,
    document.body,
  )
}

export function TransactionForm({
  accounts,
  categories,
  merchants,
  merchantGroups,
  initialPreset,
  rateTable,
  mode = 'create',
  transaction = null,
  returnUrl,
  initialKind: initialKindProp,
  recentAccountIdsByKind,
}: Props) {
  const isEditMode = mode === 'edit' && transaction != null
  const initialKind = (isEditMode ? transaction.kind : (initialKindProp ?? 'expense')) as Kind
  const initialCategorySelection =
    initialKind === 'reminder'
      ? { parentId: '', categoryId: '' }
      : resolveCategorySelection(
          buildCategoryPickerGroups(categories, initialKind),
          isEditMode ? transaction.category_id : initialPreset?.categoryId,
        )
  const formRef = useRef<HTMLFormElement>(null)
  const kindCarouselRef = useRef<HTMLDivElement>(null)
  const swipeSyncTimeoutRef = useRef<number | null>(null)
  const programmaticScrollRef = useRef(false)
  const programmaticScrollTimeoutRef = useRef<number | null>(null)
  const transferTargetManualRef = useRef(isEditMode && initialKind === 'transfer')
  const skipNextAmountClickRef = useRef(false)
  const router = useRouter()
  const [kind, setKind] = useState<Kind>(initialKind)
  const [pending, setPending] = useState(false)
  const submittingRef = useRef(false)
  const submittedRef = useRef(false)
  const prevAmountRef = useRef('')
  const prevReminderTitleRef = useRef('')
  const [amount, setAmount] = useState(isEditMode ? String(Number(transaction.amount)) : '')
  const [transferTargetAmount, setTransferTargetAmount] = useState(
    isEditMode && initialKind === 'transfer'
      ? String(Number(transaction.transfer_target_amount ?? transaction.amount))
      : '',
  )
  const [activeTransferAmountSide, setActiveTransferAmountSide] = useState<TransferAmountSide>('source')
  const [isKeypadVisible, setIsKeypadVisible] = useState(true)
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false)
  const [isMerchantPickerOpen, setIsMerchantPickerOpen] = useState(false)
  const [isMerchantManagerOpen, setIsMerchantManagerOpen] = useState(false)
  const [isKindDragging, setIsKindDragging] = useState(false)
  const [managedCategories] = useState(() => categories)
  const [managedMerchants, setManagedMerchants] = useState(() => merchants)
  const [managedMerchantGroups, setManagedMerchantGroups] = useState(() => merchantGroups)
  const [currency, setCurrency] = useState<Currency>(() => {
    const fallbackCurrency = isCurrency(isEditMode ? transaction.currency : initialPreset?.currency)
      ? (isEditMode ? transaction.currency : initialPreset?.currency) as Currency
      : 'TWD'

    if (initialKind === 'transfer') {
      const initialSourceId = isEditMode ? transaction.account_id ?? '' : initialPreset?.accountId ?? ''
      const initialSourceAccount = accounts.find((account) => account.id === initialSourceId)
      if (initialSourceAccount && isCurrency(initialSourceAccount.currency)) {
        return initialSourceAccount.currency as Currency
      }
    }

    return fallbackCurrency
  })
  const [categoryId, setCategoryId] = useState(initialCategorySelection.categoryId)
  const [accountId, setAccountId] = useState(isEditMode ? transaction.account_id ?? '' : initialPreset?.accountId ?? '')
  const [toAccountId, setToAccountId] = useState(isEditMode ? transaction.to_account_id ?? '' : initialPreset?.toAccountId ?? '')
  const [merchant, setMerchant] = useState(isEditMode ? transaction.merchant ?? '' : '')
  const [occurredAt, setOccurredAt] = useState(isEditMode ? toLocalDateTimeValue(transaction.occurred_at ?? transaction.created_at) : currentLocalDateTimeValue)
  const [reminderTitle, setReminderTitle] = useState(isEditMode ? transaction.title ?? '' : '')
  const [reminderCategory, setReminderCategory] = useState<ReminderCategory>('其他')
  const [reminderFrequency, setReminderFrequency] = useState<ReminderFrequency>('quarterly')
  const [reminderDueOn, setReminderDueOn] = useState(currentLocalDateValue)
  const [owner, setOwner] = useState<Owner>(
    isOwner(isEditMode ? transaction.owner : initialPreset?.owner)
      ? (isEditMode ? transaction.owner : initialPreset?.owner) as Owner
      : 'Oscar',
  )
  const [note, setNote] = useState(isEditMode ? transaction.note ?? '' : '')
  const [recurringOn, setRecurringOn] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [recurringEndType, setRecurringEndType] = useState<'forever' | 'count'>('forever')
  const [recurringEndCount, setRecurringEndCount] = useState<number>(12)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const availableKinds = useMemo(
    () => (isEditMode ? KINDS.filter((item) => item !== 'reminder') : KINDS),
    [isEditMode],
  )

  const categoryGroupsByKind = useMemo<Record<Kind, CategoryPickerGroup[]>>(() => ({
    expense: buildCategoryPickerGroups(managedCategories, 'expense'),
    income: buildCategoryPickerGroups(managedCategories, 'income'),
    transfer: buildCategoryPickerGroups(managedCategories, 'transfer'),
    reminder: [],
  }), [managedCategories])
  const categoryById = useMemo(
    () => new Map(managedCategories.map((category) => [category.id, category])),
    [managedCategories],
  )
  const categoryPathById = useMemo(() => {
    const paths = new Map<string, string>()

    for (const category of managedCategories) {
      if (!category.parent_id) {
        paths.set(category.id, category.name)
        continue
      }

      const parent = categoryById.get(category.parent_id)
      paths.set(category.id, parent ? `${parent.name} › ${category.name}` : category.name)
    }

    return paths
  }, [categoryById, managedCategories])
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )
  const accountOptions = useMemo(
    () => buildAccountOptions(accounts),
    [accounts],
  )
  const reminderAccountOptions = accountOptions
  const [showAllAccounts, setShowAllAccounts] = useState(false)
  const frequentAccountIdsByKind = useMemo(() => {
    const result: Record<Kind, string[]> = {
      expense: selectFrequentAccountIds('expense', recentAccountIdsByKind, accounts),
      income: selectFrequentAccountIds('income', recentAccountIdsByKind, accounts),
      transfer: selectFrequentAccountIds('transfer', recentAccountIdsByKind, accounts),
      reminder: selectFrequentAccountIds('reminder', recentAccountIdsByKind, accounts),
    }
    return result
  }, [accounts, recentAccountIdsByKind])
  const buildShortAccountOptions = (frequentIds: string[], extraIds: string[]) => {
    if (frequentIds.length === 0) return accountOptions
    const wanted = new Set<string>(frequentIds)
    for (const id of extraIds) if (id) wanted.add(id)
    const filtered = accounts.filter((account) => wanted.has(account.id))
    return buildAccountOptions(filtered)
  }
  const kindDragStateRef = useRef<{
    active: boolean
    pointerId: number | null
    startX: number
    startScrollLeft: number
  } | null>(null)

  const categoryGroups = categoryGroupsByKind[kind]
  const transactionKind: TransactionKind = kind === 'reminder' ? 'expense' : kind
  const resolvedCategorySelection = resolveCategorySelection(categoryGroups, categoryId)
  const resolvedParentId = resolvedCategorySelection.parentId
  const resolvedCategoryId = resolvedCategorySelection.categoryId
  const resolvedAccountId = accountById.has(accountId) ? accountId : ''
  const resolvedToAccountId = accountById.has(toAccountId) ? toAccountId : ''
  const selectedCategory = categoryById.get(resolvedCategoryId) ?? null
  const selectedAccount = accountById.get(resolvedAccountId) ?? null
  const selectedToAccount = accountById.get(resolvedToAccountId) ?? null
  const resolvedReminderAccountId = accountById.has(accountId) ? accountId : ''
  const selectedReminderAccount = accountById.get(resolvedReminderAccountId) ?? null
  const amountValue = parseAmount(amount)
  const transferSourceCurrency = (selectedAccount?.currency || currency || 'TWD').toUpperCase()
  const transferDestinationCurrency = (selectedToAccount?.currency || transferSourceCurrency).toUpperCase()
  const transferIsCrossCurrency = transferSourceCurrency !== transferDestinationCurrency
  const transferTargetAmountValue = transferIsCrossCurrency ? parseAmount(transferTargetAmount) : amountValue
  const transferResolvedAmounts =
    kind !== 'transfer' || !selectedAccount || !selectedToAccount
      ? null
      : (transferIsCrossCurrency ? transferTargetAmountValue >= 0 : true)
        ? {
            sourceAmount: amountValue,
            sourceCurrency: transferSourceCurrency,
            targetAmount: transferTargetAmountValue,
            targetCurrency: transferDestinationCurrency,
            isCrossCurrency: transferIsCrossCurrency,
          }
        : null
  const canSubmit =
    kind === 'reminder'
      ? Boolean(reminderTitle.trim()) && Boolean(reminderDueOn)
      : kind === 'transfer'
        ? Boolean(resolvedAccountId)
          && Boolean(resolvedToAccountId)
          && transferResolvedAmounts !== null
        : Boolean(resolvedAccountId)
  const showKeypad = isKeypadVisible && kind !== 'reminder'

  useEffect(() => {
    const container = kindCarouselRef.current
    if (!container) return

    const index = availableKinds.indexOf(kind)
    const card = container.children.item(index) as HTMLElement | null
    if (!card) return

    const targetLeft = card.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft
    if (Math.abs(container.scrollLeft - targetLeft) < 4) return
    programmaticScrollRef.current = true
    if (programmaticScrollTimeoutRef.current != null) window.clearTimeout(programmaticScrollTimeoutRef.current)
    programmaticScrollTimeoutRef.current = window.setTimeout(() => { programmaticScrollRef.current = false }, 500)
    container.scrollTo({ left: targetLeft, behavior: 'smooth' })
  }, [availableKinds, kind])

  useEffect(() => {
    return () => {
      if (swipeSyncTimeoutRef.current != null) {
        window.clearTimeout(swipeSyncTimeoutRef.current)
      }
    }
  }, [])


  useEffect(() => {
    const amountFresh = prevAmountRef.current === '' && amount !== ''
    const reminderFresh = prevReminderTitleRef.current === '' && reminderTitle !== ''
    if (amountFresh || reminderFresh) {
      submittedRef.current = false
    }
    prevAmountRef.current = amount
    prevReminderTitleRef.current = reminderTitle
  }, [amount, reminderTitle])

  useEffect(() => {
    if (!isCategoryPickerOpen && !isMerchantPickerOpen && !isMerchantManagerOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isCategoryPickerOpen, isMerchantPickerOpen, isMerchantManagerOpen])

  async function handleSubmit(formData: FormData) {
    if (submittingRef.current) return
    if (submittedRef.current) return
    if (!canSubmit) return
    submittingRef.current = true
    let keepPendingAfterSubmit = false

    const submitMode = !isEditMode && formData.get('submitMode') === 'stay' ? 'stay' : 'ledger'
    const transferTargetAmount =
      kind === 'transfer'
        ? (transferIsCrossCurrency ? transferTargetAmountValue : amountValue)
        : transaction?.transfer_target_amount ?? null
    const transferTargetCurrency =
      kind === 'transfer'
        ? transferDestinationCurrency
        : transaction?.transfer_target_currency ?? null

    setMessage(null)

    const isOptimisticTxSave = kind !== 'reminder' && (isEditMode || submitMode === 'ledger')
    if (isOptimisticTxSave) {
      submittedRef.current = true
      setPending(true)
      formData.set('amount', String(amountValue))
      formData.set('kind', kind)
      formData.set('currency', currency)
      formData.set('category_id', resolvedCategoryId)
      formData.set('account_id', resolvedAccountId)
      formData.set('to_account_id', kind === 'transfer' ? resolvedToAccountId : '')
      formData.set(
        'transfer_target_amount',
        kind === 'transfer' && transferTargetAmount != null ? String(transferTargetAmount) : '',
      )
      formData.set(
        'transfer_target_currency',
        kind === 'transfer' && transferTargetCurrency ? transferTargetCurrency : '',
      )
      formData.set('merchant', merchant)
      formData.set('occurred_at', occurredAt)
      formData.set('owner', owner)
      formData.set('note', note)
      if (selectedCategory) formData.set('category_name', selectedCategory.name)

      const recurringPayload = !isEditMode && recurringOn && resolvedCategoryId && resolvedAccountId
        ? {
            name: merchant.trim() || (selectedCategory?.name ?? '定期交易'),
            kind: kind as 'income' | 'expense' | 'transfer',
            amount: amountValue,
            currency,
            accountId: resolvedAccountId,
            targetAccountId: kind === 'transfer' ? (resolvedToAccountId || null) : null,
            targetAmount: kind === 'transfer' ? transferTargetAmount : null,
            targetCurrency: kind === 'transfer' ? transferTargetCurrency : null,
            categoryId: resolvedCategoryId,
            merchantId: null,
            owner,
            frequency: recurringFrequency,
            startDate: occurredAt.slice(0, 10),
            endType: recurringEndType,
            endCount: recurringEndType === 'count' ? recurringEndCount : null,
            notes: note || null,
          }
        : null

      const editingTransactionId = isEditMode ? transaction.id : null
      router.push(returnUrl ?? ledgerHrefForOccurredAt(occurredAt))

      void (async () => {
        try {
          const saveResult = editingTransactionId
            ? await updateTransaction(editingTransactionId, formData)
            : await createTransaction(formData)
          if (!saveResult.ok) {
            console.error(
              editingTransactionId ? 'updateTransaction failed:' : 'createTransaction failed:',
              saveResult.error,
            )
            return
          }
          if (recurringPayload) {
            const recurringResult = await createRecurringTransaction(recurringPayload)
            if (!recurringResult.ok) {
              console.error('createRecurringTransaction failed:', recurringResult.error)
            }
          }
          router.refresh()
        } catch (err) {
          console.error(
            editingTransactionId ? 'updateTransaction threw:' : 'createTransaction threw:',
            err,
          )
        } finally {
          submittingRef.current = false
        }
      })()

      return
    }

    setPending(true)
    try {
      const result = kind === 'reminder'
        ? await createMaintenanceReminder(
            (() => {
              const reminderData = new FormData()
              reminderData.set('name', reminderTitle.trim())
              reminderData.set('category', reminderCategory)
              reminderData.set('account_id', resolvedReminderAccountId)
              reminderData.set('frequency', reminderFrequency)
              reminderData.set('due_on', reminderDueOn)
              reminderData.set('detail', note)
              return reminderData
            })(),
          )
        : isEditMode
          ? await updateTransaction(transaction.id, (() => {
              formData.set('amount', String(amountValue))
              formData.set('kind', kind)
              formData.set('currency', currency)
              formData.set('category_id', resolvedCategoryId)
              formData.set('account_id', resolvedAccountId)
              formData.set('to_account_id', kind === 'transfer' ? resolvedToAccountId : '')
              formData.set(
                'transfer_target_amount',
                kind === 'transfer' && transferTargetAmount != null ? String(transferTargetAmount) : '',
              )
              formData.set(
                'transfer_target_currency',
                kind === 'transfer' && transferTargetCurrency ? transferTargetCurrency : '',
              )
              formData.set('merchant', merchant)
              formData.set('occurred_at', occurredAt)
              formData.set('owner', owner)
              formData.set('note', note)
              if (selectedCategory) formData.set('category_name', selectedCategory.name)
              return formData
            })())
          : await createTransaction((() => {
              formData.set('amount', String(amountValue))
              formData.set('kind', kind)
              formData.set('currency', currency)
              formData.set('category_id', resolvedCategoryId)
              formData.set('account_id', resolvedAccountId)
              formData.set('to_account_id', kind === 'transfer' ? resolvedToAccountId : '')
              formData.set(
                'transfer_target_amount',
                kind === 'transfer' && transferTargetAmount != null ? String(transferTargetAmount) : '',
              )
              formData.set(
                'transfer_target_currency',
                kind === 'transfer' && transferTargetCurrency ? transferTargetCurrency : '',
              )
              formData.set('merchant', merchant)
              formData.set('occurred_at', occurredAt)
              formData.set('owner', owner)
              formData.set('note', note)
              if (selectedCategory) formData.set('category_name', selectedCategory.name)
              return formData
            })())
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        return
      }
      submittedRef.current = true

      if (!isEditMode && recurringOn && kind !== 'reminder' && resolvedCategoryId && resolvedAccountId) {
        const startDate = occurredAt.slice(0, 10)
        const recurringResult = await createRecurringTransaction({
          name: merchant.trim() || (selectedCategory?.name ?? '定期交易'),
          kind: kind as 'income' | 'expense' | 'transfer',
          amount: amountValue,
          currency,
          accountId: resolvedAccountId,
          targetAccountId: kind === 'transfer' ? (resolvedToAccountId || null) : null,
          targetAmount: kind === 'transfer' ? transferTargetAmount : null,
          targetCurrency: kind === 'transfer' ? transferTargetCurrency : null,
          categoryId: resolvedCategoryId,
          merchantId: null,
          owner,
          frequency: recurringFrequency,
          startDate,
          endType: recurringEndType,
          endCount: recurringEndType === 'count' ? recurringEndCount : null,
          notes: note || null,
        })
        if (!recurringResult.ok) {
          console.error('createRecurringTransaction failed:', recurringResult.error)
        }
      }

      if (kind === 'reminder') {
        setReminderTitle('')
        setNote('')
        if (submitMode !== 'stay') {
          setReminderDueOn(currentLocalDateValue())
        }
        setMessage({ tone: 'success', text: '提醒已儲存。' })
        return
      }

      if (submitMode === 'stay') {
        setAmount('')
        setTransferTargetAmount('')
        setActiveTransferAmountSide('source')
        setMerchant('')
        setNote('')
        setOccurredAt(currentLocalDateTimeValue())
        setIsKeypadVisible(true)
        setMessage({ tone: 'success', text: '已儲存，可以繼續記下一筆。' })
        return
      }

      keepPendingAfterSubmit = true
      router.push(returnUrl ?? ledgerHrefForOccurredAt(occurredAt))
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : `${isEditMode ? '更新' : '新增'}失敗，請稍後再試。`,
      })
    } finally {
      submittingRef.current = false
      if (!keepPendingAfterSubmit) {
        setPending(false)
      }
    }
  }

  function handleDelete() {
    if (!isEditMode) return
    if (submittingRef.current) return
    if (submittedRef.current) return
    if (!window.confirm('確定要刪除這筆交易嗎？帳戶餘額也會一起沖回。')) return

    submittingRef.current = true
    submittedRef.current = true
    setPending(true)
    setMessage(null)

    const deletingTransactionId = transaction.id
    router.push(returnUrl ?? ledgerHrefForOccurredAt(occurredAt))

    void (async () => {
      try {
        await deleteTransaction(deletingTransactionId)
        router.refresh()
      } catch (err) {
        console.error('deleteTransaction threw:', err)
      } finally {
        submittingRef.current = false
      }
    })()
  }

  function updateKind(nextKind: Kind) {
    if (nextKind === kind) return
    if (isEditMode && nextKind === 'reminder') return
    setIsCategoryPickerOpen(false)
    setIsMerchantPickerOpen(false)
    setIsMerchantManagerOpen(false)
    setKind(nextKind)
    if (nextKind === 'reminder') {
      setIsKeypadVisible(false)
      return
    }

    const nextCategorySelection = resolveCategorySelection(
      categoryGroupsByKind[nextKind],
      '',
    )
    setCategoryId(nextCategorySelection.categoryId)
    if (nextKind !== 'transfer') {
      setToAccountId('')
      return
    }

    setActiveTransferAmountSide('source')
    const nextSourceAccount = accountById.get(accountId)
    if (nextSourceAccount && isCurrency(nextSourceAccount.currency)) {
      setCurrency(nextSourceAccount.currency as Currency)
    }
  }

  function handleParentCategoryChange(parentId: string) {
    const nextGroup = categoryGroups.find((group) => group.parent.id === parentId)
    if (!nextGroup) return

    setCategoryId(nextGroup.children[0]?.id ?? nextGroup.parent.id)
  }

  function handleTransferSourceChange(value: string) {
    setAccountId(value)
    transferTargetManualRef.current = false
    const nextAccount = accountById.get(value)
    if (nextAccount && isCurrency(nextAccount.currency)) {
      setCurrency(nextAccount.currency as Currency)
    }
  }

  function handleTransferTargetChange(value: string) {
    setToAccountId(value)
    transferTargetManualRef.current = false
  }

  function swapTransferAccounts() {
    setAccountId(toAccountId)
    setToAccountId(accountId)
    const nextSourceAccount = accountById.get(toAccountId)
    if (nextSourceAccount && isCurrency(nextSourceAccount.currency)) {
      setCurrency(nextSourceAccount.currency as Currency)
    }
  }

  function handleChildCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
  }

  function openCategoryPicker() {
    setIsKeypadVisible(false)
    setIsMerchantPickerOpen(false)
    setIsMerchantManagerOpen(false)
    setIsCategoryPickerOpen(true)
  }

  function openCategoryManager() {
    setIsKeypadVisible(false)
    setIsCategoryPickerOpen(false)
    setIsMerchantPickerOpen(false)
    setIsMerchantManagerOpen(false)
    router.push('/categories')
  }

  function openMerchantPicker() {
    setIsKeypadVisible(false)
    setIsCategoryPickerOpen(false)
    setIsMerchantManagerOpen(false)
    setIsMerchantPickerOpen(true)
  }

  function openMerchantManager() {
    setIsKeypadVisible(false)
    setIsCategoryPickerOpen(false)
    setIsMerchantManagerOpen(true)
    setIsMerchantPickerOpen(false)
  }

  function handleMerchantGroupUpsert(group: FamilyMerchantGroup) {
    setManagedMerchantGroups((current) => {
      const existingIndex = current.findIndex((item) => item.id === group.id)
      if (existingIndex === -1) return [...current, group]

      return current.map((item) => (item.id === group.id ? group : item))
    })
    router.refresh()
  }

  function handleMerchantGroupArchive(groupId: string) {
    setManagedMerchantGroups((current) => current.filter((group) => group.id !== groupId))
    setManagedMerchants((current) => current.map((merchant) => (
      merchant.group_id === groupId ? { ...merchant, group_id: null } : merchant
    )))
    router.refresh()
  }

  function handleMerchantUpsert(merchantItem: FamilyMerchant, previousName?: string) {
    setManagedMerchants((current) => {
      const existingIndex = current.findIndex((item) => item.id === merchantItem.id)
      if (existingIndex === -1) return [...current, merchantItem]

      return current.map((item) => (item.id === merchantItem.id ? merchantItem : item))
    })
    if (previousName && merchant.trim().toLocaleLowerCase('zh-TW') === previousName.trim().toLocaleLowerCase('zh-TW')) {
      setMerchant(merchantItem.name)
    }
    router.refresh()
  }

  function handleKindCarouselScroll() {
    if (programmaticScrollRef.current) return

    if (swipeSyncTimeoutRef.current != null) {
      window.clearTimeout(swipeSyncTimeoutRef.current)
    }

    swipeSyncTimeoutRef.current = window.setTimeout(() => {
      const container = kindCarouselRef.current
      if (!container) return

      let closestKind = kind
      let closestDistance = Number.POSITIVE_INFINITY

      availableKinds.forEach((item, index) => {
        const card = container.children.item(index) as HTMLElement | null
        if (!card) return

        const distance = Math.abs(card.offsetLeft - container.scrollLeft)
        if (distance < closestDistance) {
          closestDistance = distance
          closestKind = item
        }
      })

      if (closestKind !== kind) {
        updateKind(closestKind)
      }
    }, 90)
  }

  function handleKindCarouselPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    if (isInteractiveElement(event.target)) return

    event.preventDefault()
    const container = kindCarouselRef.current
    if (!container) return

    kindDragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    }
    setIsKindDragging(false)
    container.setPointerCapture(event.pointerId)
  }

  function handleKindCarouselPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = kindDragStateRef.current
    const container = kindCarouselRef.current
    if (!drag?.active || !container || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    if (!isKindDragging && Math.abs(deltaX) > 4) {
      setIsKindDragging(true)
    }

    if (Math.abs(deltaX) > 0) {
      event.preventDefault()
      container.scrollLeft = drag.startScrollLeft - deltaX
    }
  }

  function stopKindCarouselDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = kindDragStateRef.current
    const container = kindCarouselRef.current
    if (!drag?.active || drag.pointerId !== event.pointerId) return

    drag.active = false
    kindDragStateRef.current = null
    setIsKindDragging(false)

    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId)
    }
  }

  function handleAmountKey(key: KeypadKey) {
    if (pending) return

    if (key === 'confirm') {
      setIsKeypadVisible(false)
      return
    }

    if (kind === 'transfer') {
      const amountSide = transferIsCrossCurrency ? activeTransferAmountSide : 'source'
      const updateValue = (current: string) => {
        if (key === 'clear') return ''
        return appendAmountInput(current, key)
      }

      if (amountSide === 'target') {
        transferTargetManualRef.current = true
        setTransferTargetAmount((current) => updateValue(current))
      } else {
        const newAmount = updateValue(amount)
        setAmount(newAmount)
        if (!transferTargetManualRef.current && rateTable) {
          const srcRate = rateTable.latest.rates[transferSourceCurrency]
          const dstRate = rateTable.latest.rates[transferDestinationCurrency]
          if (srcRate && dstRate) {
            const srcAmt = parseAmount(newAmount)
            setTransferTargetAmount(srcAmt ? String(Math.round(srcAmt * (srcRate / dstRate) * 100) / 100) : '')
          }
        }
      }
      return
    }

    if (key === 'clear') {
      setAmount('')
      return
    }

    setAmount((current) => appendAmountInput(current, key))
  }

  function handleAmountPointerDown(event: PointerEvent<HTMLButtonElement>, key: KeypadKey) {
    if (event.pointerType === 'mouse') return

    event.preventDefault()
    skipNextAmountClickRef.current = true
    handleAmountKey(key)
  }

  function handleAmountClick(key: KeypadKey) {
    if (skipNextAmountClickRef.current) {
      skipNextAmountClickRef.current = false
      return
    }

    handleAmountKey(key)
  }

  function renderSubmitActions() {
    if (isEditMode) {
      return (
        <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-2 rounded-[1.65rem] bg-white/92 p-2 shadow-[0_18px_42px_rgba(15,23,42,0.12)] backdrop-blur">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="min-h-12 rounded-md border border-[#f0d3cf] bg-[#fff4f2] px-4 text-[0.95rem] font-black text-[#c9563f] transition active:scale-[0.98] disabled:bg-[#f4ebe8] disabled:text-[#d7aaa3]"
          >
            {pending ? '處理中' : '刪除'}
          </button>
          <button
            type="submit"
            name="submitMode"
            value="ledger"
            disabled={pending || !canSubmit}
            className="min-h-12 rounded-md bg-slate-950 px-4 text-[0.95rem] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition active:scale-[0.98] disabled:bg-[#d8d0c3] disabled:text-white/75 disabled:shadow-none"
          >
            {pending ? '保存中' : '儲存修改'}
          </button>
        </div>
      )
    }

    if (kind === 'reminder') {
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2 rounded-[1.65rem] bg-white/92 p-2 shadow-[0_18px_42px_rgba(15,23,42,0.12)] backdrop-blur">
          <button
            type="submit"
            name="submitMode"
            value="stay"
            disabled={pending || !canSubmit}
            className="min-h-12 rounded-md border border-[#d7e8e0] bg-[#f5fbf8] px-4 text-[0.95rem] font-black text-[#356f5f] transition active:scale-[0.98] disabled:border-transparent disabled:bg-[#edf3ef] disabled:text-slate-400"
          >
            {pending ? '保存中' : '再加一個'}
          </button>
          <button
            type="submit"
            name="submitMode"
            value="ledger"
            disabled={pending || !canSubmit}
            className="min-h-12 rounded-md bg-slate-950 px-4 text-[0.95rem] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition active:scale-[0.98] disabled:bg-[#d8d0c3] disabled:text-white/75 disabled:shadow-none"
          >
            {pending ? '保存中' : '儲存提醒'}
          </button>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2 rounded-[1.65rem] bg-white/92 p-2 shadow-[0_18px_42px_rgba(15,23,42,0.12)] backdrop-blur">
        <button
          type="submit"
          name="submitMode"
          value="stay"
          disabled={pending || !canSubmit}
          className="min-h-12 rounded-md border border-[#e7dccb] bg-[#fcfbf8] px-4 text-[0.95rem] font-black text-slate-700 transition active:scale-[0.98] disabled:border-transparent disabled:bg-[#eee8dd] disabled:text-slate-400"
        >
          {pending ? '保存中' : '再記一筆'}
        </button>
        <button
          type="submit"
          name="submitMode"
          value="ledger"
          disabled={pending || !canSubmit}
          className="min-h-12 rounded-md bg-slate-950 px-4 text-[0.95rem] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition active:scale-[0.98] disabled:bg-[#d8d0c3] disabled:text-white/75 disabled:shadow-none"
        >
          {pending ? '保存中' : '保存'}
        </button>
      </div>
    )
  }

  function renderEntryPage(pageKind: Kind) {
    const pageCategoryGroups = categoryGroupsByKind[pageKind]
    const pageCategorySelection = resolveCategorySelection(
      pageCategoryGroups,
      pageKind === kind ? categoryId : '',
    )
    const pageCategoryPath = categoryPathById.get(pageCategorySelection.categoryId) ?? '選擇分類'
    const pageSelectedCategory = categoryById.get(pageCategorySelection.categoryId) ?? null

    const recurringSectionJsx = isEditMode || pageKind === 'reminder' ? null : (!recurringOn ? (
      <div className="px-5 py-4">
        <button
          type="button"
          onClick={() => setRecurringOn(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#d8c4a0] bg-[#fff8ed] px-3 py-1.5 text-[0.78rem] font-black text-[#a37a1c] active:bg-[#fdeacf]"
        >
          <span>＋</span>
          <span>週期</span>
        </button>
      </div>
    ) : (
      <div className="border-t border-[#efebe4] bg-[#fff8ed] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🔁</span>
            <span className="text-[0.95rem] font-black text-slate-900">週期設定</span>
          </div>
          <button
            type="button"
            onClick={() => setRecurringOn(false)}
            className="rounded-full bg-white px-3 py-1 text-[0.72rem] font-black text-slate-500"
          >
            移除
          </button>
        </div>
        <div className="mb-3">
          <div className="mb-2 text-[0.72rem] font-black tracking-[0.12em] text-slate-500">頻率</div>
          <div className="grid grid-cols-4 gap-1.5">
            {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setRecurringFrequency(f)}
                className={`rounded-full py-2 text-[0.85rem] font-black ${
                  recurringFrequency === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'
                }`}
              >
                {f === 'weekly' ? '每週' : f === 'monthly' ? '每月' : f === 'quarterly' ? '每季' : '每年'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[0.72rem] font-black tracking-[0.12em] text-slate-500">結束方式</div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setRecurringEndType('forever')}
              className={`flex w-full items-center justify-between rounded-[1rem] px-4 py-2.5 text-left ${
                recurringEndType === 'forever' ? 'bg-white shadow-sm' : 'bg-transparent'
              }`}
            >
              <span className="text-[0.95rem] font-black text-slate-900">一直重複</span>
              <span className={`h-4 w-4 rounded-full border-2 ${
                recurringEndType === 'forever' ? 'border-[#d8a72a] bg-[#d8a72a]' : 'border-slate-300'
              }`} />
            </button>
            <div className={`flex items-center justify-between rounded-[1rem] px-4 py-2.5 ${
              recurringEndType === 'count' ? 'bg-white shadow-sm' : 'bg-transparent'
            }`}>
              <button
                type="button"
                onClick={() => setRecurringEndType('count')}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="text-[0.95rem] font-black text-slate-900">共</span>
                <input
                  type="number"
                  min="1"
                  value={recurringEndCount}
                  onChange={(e) => setRecurringEndCount(Math.max(1, Number(e.target.value)))}
                  onFocus={() => setRecurringEndType('count')}
                  className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-[0.95rem] font-black text-slate-900 outline-none"
                />
                <span className="text-[0.95rem] font-black text-slate-900">次</span>
              </button>
              <span className={`h-4 w-4 rounded-full border-2 ${
                recurringEndType === 'count' ? 'border-[#d8a72a] bg-[#d8a72a]' : 'border-slate-300'
              }`} />
            </div>
          </div>
        </div>
      </div>
    ))

    if (pageKind === 'reminder') {
      return (
        <article
          key={pageKind}
          className="w-full shrink-0 snap-center"
          aria-label={`${KIND_LABELS[pageKind]} 頁`}
        >
          <section className="overflow-hidden bg-white px-4 pb-2 pt-2 border-b border-[#f0f0f0]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-black tracking-[0.18em] text-[#5b8c79]">提辦</p>
                <h2 className="mt-1.5 text-[1.4rem] font-black leading-tight text-slate-950">
                  把重要的事先排進行事曆
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  帳單繳費、定期保養、家事待辦都可以記在這裡。
                </p>
              </div>
            </div>

            <div className={`mt-4 h-1 rounded-full ${amountLineClass(pageKind)}`} />
          </section>

          <section className="overflow-hidden bg-white">
            <div className="flex min-h-[2.8rem] items-center justify-between gap-4 px-5">
              <FieldLabel tone="bg-[#4f8d7c]" label="類別" />
              <div className="flex flex-wrap justify-end gap-1.5">
                {REMINDER_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setReminderCategory(cat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                      reminderCategory === cat
                        ? 'bg-[#4f8d7c] text-white'
                        : 'bg-[#f0f7f4] text-[#4f8d7c]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="mx-5 h-px bg-[#edf2ed]" />
            <TextFieldRow
              tone="bg-[#4f8d7c]"
              label="事項名稱"
              placeholder="例：RO 濾心更換"
              value={reminderTitle}
              onChange={setReminderTitle}
            />
            <div className="mx-5 h-px bg-[#edf2ed]" />
            <SelectFieldRow
              tone="bg-[#6b9d89]"
              label="關聯帳戶"
              value={selectedReminderAccount ? formatAccountLabel(selectedReminderAccount) : '選擇帳戶（選填）'}
              selectedValue={resolvedReminderAccountId}
              onChange={setAccountId}
              options={[
                { value: '', label: '不連結帳戶' },
                ...reminderAccountOptions,
              ]}
            />
            <div className="mx-5 h-px bg-[#edf2ed]" />
            <SelectFieldRow
              tone="bg-[#85a86c]"
              label="頻率"
              value={REMINDER_FREQUENCY_LABELS[reminderFrequency]}
              selectedValue={reminderFrequency}
              onChange={(value) => {
                if (REMINDER_FREQUENCIES.includes(value as ReminderFrequency)) {
                  setReminderFrequency(value as ReminderFrequency)
                }
              }}
              options={REMINDER_FREQUENCIES.map((frequency) => ({
                value: frequency,
                label: REMINDER_FREQUENCY_LABELS[frequency],
              }))}
            />
            <div className="mx-5 h-px bg-[#edf2ed]" />
            <ReminderDueDateRow value={reminderDueOn} onChange={setReminderDueOn} />
            <div className="mx-5 h-px bg-[#edf2ed]" />
            <TextFieldRow
              tone="bg-[#8a7de2]"
              label="備註"
              placeholder="例：3M 型號、安裝日期、注意事項"
              value={note}
              onChange={setNote}
            />
          </section>
        </article>
      )
    }

    if (pageKind === 'transfer') {
      return (
        <article
          key={pageKind}
          className="w-full shrink-0 snap-center"
          aria-label={`${KIND_LABELS[pageKind]} 頁`}
        >
          <section className="overflow-hidden bg-white px-4 pb-2 pt-2 border-b border-[#f0f0f0]">
            {transferIsCrossCurrency ? (
              <div className="mt-4">
                <TransferAmountPairRow
                  sourceAmount={amount}
                  sourceCurrency={transferSourceCurrency}
                  targetAmount={transferTargetAmount}
                  targetCurrency={transferDestinationCurrency}
                  activeSide={activeTransferAmountSide}
                  onSourceOpen={() => {
                    setActiveTransferAmountSide('source')
                    setIsKeypadVisible(true)
                  }}
                  onTargetOpen={() => {
                    setActiveTransferAmountSide('target')
                    setIsKeypadVisible(true)
                  }}
                />
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTransferAmountSide('source')
                    setIsKeypadVisible(true)
                  }}
                  className={`block text-left font-black ${amountDisplayClass(pageKind)} ${amountAccentClass(pageKind)}`}
                  aria-label="開啟轉帳數字鍵盤"
                >
                  {formatAmountDisplay(amount)}
                </button>
                <label className="relative inline-flex items-center gap-2 rounded-full bg-[#f4f1ea] px-3 py-2 text-sm font-black text-slate-600">
                  <span>{currency}</span>
                  <span className="text-slate-300">▾</span>
                  <select
                    value={currency}
                    onChange={(event) => {
                      const value = event.target.value
                      if (isCurrency(value)) setCurrency(value)
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="幣別"
                  >
                    {CURRENCIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <div className={`mt-3 h-1 rounded-full ${amountLineClass(pageKind)}`} />
          </section>

          <section className="overflow-hidden bg-white">
            {(() => {
              const frequentIds = frequentAccountIdsByKind.transfer
              const transferOptions = showAllAccounts
                ? accountOptions
                : buildShortAccountOptions(frequentIds, [resolvedAccountId, resolvedToAccountId])
              const totalGroupCount = accountOptions.reduce((sum, group) => sum + group.options.length, 0)
              const shortGroupCount = transferOptions.reduce((sum, group) => sum + group.options.length, 0)
              const canToggle = totalGroupCount > shortGroupCount || showAllAccounts
              return (
                <>
                  <TransferAccountRow
                    label="轉出"
                    value={selectedAccount ? formatAccountLabel(selectedAccount) : '選擇轉出帳戶'}
                    selectedValue={resolvedAccountId}
                    onChange={handleTransferSourceChange}
                    options={[{ value: '', label: '選擇轉出帳戶' }, ...transferOptions]}
                  />
                  <div className="flex items-center px-5">
                    <div className="h-px flex-1 bg-[#efebe4]" />
                    <button
                      type="button"
                      onClick={swapTransferAccounts}
                      className="mx-3 flex size-7 shrink-0 items-center justify-center rounded-full border border-[#ece4d8] bg-[#fdf9f4] text-base text-[#d18c11] transition hover:bg-[#fff8e7]"
                      aria-label="交換轉出與轉入帳戶"
                    >
                      ⇅
                    </button>
                    <div className="h-px flex-1 bg-[#efebe4]" />
                  </div>
                  <TransferAccountRow
                    label="轉入"
                    value={selectedToAccount ? formatAccountLabel(selectedToAccount) : '選擇轉入帳戶'}
                    selectedValue={resolvedToAccountId}
                    onChange={handleTransferTargetChange}
                    options={[{ value: '', label: '選擇轉入帳戶' }, ...transferOptions]}
                  />
                  {canToggle && (
                    <ShowAllAccountsToggle
                      showAll={showAllAccounts}
                      onToggle={() => setShowAllAccounts((value) => !value)}
                    />
                  )}
                </>
              )
            })()}
            <div className="mx-5 h-px bg-[#efebe4]" />
            <DateFieldRow value={occurredAt} onChange={setOccurredAt} />
            <div className="mx-5 h-px bg-[#efebe4]" />
            <TextFieldRow
              tone="bg-[#8f86f2]"
              label="備註"
              placeholder="補充說明（選填）"
              value={note}
              onChange={setNote}
            />
            {recurringSectionJsx}
          </section>
        </article>
      )
    }

    return (
      <article
        key={pageKind}
        className="w-full shrink-0 snap-center"
        aria-label={`${KIND_LABELS[pageKind]} 頁`}
      >
        <section className="overflow-hidden bg-white px-4 pb-2 pt-2 border-b border-[#f0f0f0]">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (pageKind !== kind) updateKind(pageKind)
                setIsKeypadVisible(true)
              }}
              className={`block text-left font-black ${amountDisplayClass(pageKind)} ${amountAccentClass(pageKind)}`}
              aria-label={`開啟${KIND_LABELS[pageKind]}數字鍵盤`}
            >
              {formatAmountDisplay(amount)}
            </button>

            <label className="relative inline-flex items-center gap-2 rounded-full bg-[#f4f1ea] px-3 py-2 text-sm font-black text-slate-600">
              <span>{currency}</span>
              <span className="text-slate-300">▾</span>
              <select
                value={currency}
                onChange={(event) => {
                  const value = event.target.value
                  if (isCurrency(value)) setCurrency(value)
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="幣別"
              >
                {CURRENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={`mt-3 h-1 rounded-full ${amountLineClass(pageKind)}`} />
        </section>

        <section className="overflow-hidden bg-white">
          <CategoryFieldRow
            value={pageSelectedCategory ? categoryPathById.get(pageSelectedCategory.id) ?? pageCategoryPath : pageCategoryPath}
            onOpen={openCategoryPicker}
          />
          <div className="mx-5 h-px bg-[#efebe4]" />
          {(() => {
            const frequentIds = frequentAccountIdsByKind[pageKind] ?? []
            const frequentAccounts = frequentIds
              .map((id) => accountById.get(id))
              .filter((account): account is NonNullable<typeof account> => Boolean(account))
            const shortOptions = showAllAccounts
              ? accountOptions
              : buildShortAccountOptions(frequentIds, [resolvedAccountId])
            const totalGroupCount = accountOptions.reduce((sum, group) => sum + group.options.length, 0)
            const shortGroupCount = shortOptions.reduce((sum, group) => sum + group.options.length, 0)
            const canToggle = totalGroupCount > shortGroupCount || showAllAccounts
            return (
              <>
                <AccountChipRow
                  accounts={frequentAccounts}
                  selectedId={resolvedAccountId}
                  onSelect={(id) => setAccountId(id)}
                />
                <SelectFieldRow
                  tone="bg-[#f0b542]"
                  label={accountFieldLabel(pageKind)}
                  value={selectedAccount ? formatAccountLabel(selectedAccount) : accountFieldPlaceholder(pageKind)}
                  selectedValue={resolvedAccountId}
                  onChange={setAccountId}
                  options={[
                    { value: '', label: accountFieldPlaceholder(pageKind) },
                    ...shortOptions,
                  ]}
                />
                {canToggle && (
                  <ShowAllAccountsToggle
                    showAll={showAllAccounts}
                    onToggle={() => setShowAllAccounts((value) => !value)}
                  />
                )}
              </>
            )
          })()}

          <div className="mx-5 h-px bg-[#efebe4]" />
          <DateFieldRow value={occurredAt} onChange={setOccurredAt} />
          <div className="mx-5 h-px bg-[#efebe4]" />
          <OwnerFieldRow owner={owner} onChange={setOwner} />
          <div className="mx-5 h-px bg-[#efebe4]" />
          <MerchantFieldRow
            value={merchant}
            onOpen={openMerchantPicker}
          />
          <div className="mx-5 h-px bg-[#efebe4]" />
          <TextFieldRow
            tone="bg-[#8f86f2]"
            label="備註"
            placeholder="補充說明（選填）"
            value={note}
            onChange={setNote}
          />
          {recurringSectionJsx}
        </section>
      </article>
    )
  }

  return (
    <>
      <form
        ref={formRef}
        action={handleSubmit}
        className={showKeypad ? FORM_PADDING_WITH_KEYPAD : FORM_PADDING_WITHOUT_KEYPAD}
      >
      <div className="sticky top-0 z-30 bg-[#faf7f0]/92 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <div className={`mx-auto grid w-full max-w-md ${availableKinds.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} border-b border-[#ece4d8] px-1`}>
          {availableKinds.map((item) => {
            const isActive = kind === item

            return (
              <button
                key={item}
                type="button"
                onClick={() => updateKind(item)}
                aria-pressed={isActive}
                className={`relative py-2 text-center text-[0.92rem] font-black transition ${
                  isActive ? 'text-slate-950' : 'text-slate-400'
                }`}
              >
                {KIND_LABELS[item]}
                {isActive ? <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-[#f2b232]" /> : null}
              </button>
            )
          })}
        </div>

      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4">
        {message ? (
          <div
            className={`rounded-[1.5rem] px-4 py-3 text-sm font-black shadow-[0_12px_24px_rgba(15,23,42,0.06)] ${
              message.tone === 'success'
                ? 'bg-[#ebfff7] text-[#187d5f]'
                : 'bg-[#fff3f2] text-[#c2413a]'
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <div
          ref={kindCarouselRef}
          onScroll={handleKindCarouselScroll}
          onPointerDown={handleKindCarouselPointerDown}
          onPointerMove={handleKindCarouselPointerMove}
          onPointerUp={stopKindCarouselDrag}
          onPointerCancel={stopKindCarouselDrag}
          className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto ${isKindDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {availableKinds.map((item) => renderEntryPage(item))}
        </div>
      </div>

      {kind !== 'reminder' ? (
        <button
          type="button"
          aria-label={isKeypadVisible ? '收起數字鍵盤' : '展開數字鍵盤'}
          onClick={() => setIsKeypadVisible((v) => !v)}
          className="fixed right-0 top-1/2 z-[70] flex h-14 w-7 -translate-y-1/2 items-center justify-center rounded-l-xl bg-[#c8c8c8] text-white shadow-md transition active:bg-[#aaaaaa]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d={isKeypadVisible ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </button>
      ) : null}

      {showKeypad ? (
        <>
          <button
            type="button"
            aria-label="收起數字鍵盤"
            onClick={() => setIsKeypadVisible(false)}
            className="fixed inset-x-0 bottom-0 top-[calc(5.25rem+env(safe-area-inset-top))] z-40 bg-transparent"
          />

          <div
            className="fixed inset-x-0 z-[60]"
            style={{ bottom: KEYPAD_FOOTER_BOTTOM_OFFSET }}
            aria-hidden={!showKeypad}
          >
            <div className="mx-auto flex w-full max-w-md flex-col">
              <div className="border-t border-[#e0e0e0] bg-[#ececec]">
                <div className="flex items-stretch">
                  <div className={`grid w-[2.75rem] shrink-0 ${availableKinds.length === 4 ? 'grid-rows-4' : 'grid-rows-3'}`}>
                    {availableKinds.map((item) => {
                      const isActive = kind === item
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => updateKind(item)}
                          aria-pressed={isActive}
                          className={`flex flex-col items-center justify-center text-[0.8rem] font-black leading-[1.15] tracking-tight transition ${
                            isActive
                              ? `${keypadShortcutActiveClass(item)}`
                              : 'bg-[#ececec] text-slate-500'
                          }`}
                        >
                          {Array.from(KIND_LABELS[item]).map((ch, i) => (
                            <span key={i}>{ch}</span>
                          ))}
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid min-w-0 flex-1 grid-cols-4 gap-px bg-[#dcdcdc]">
                    {KEYPAD_KEYS.map((key, index) => {
                      if (key === 'confirm' && index === 15) return null

                      if (key === 'confirm') {
                        return (
                          <button
                            key={`${key}-${index}`}
                            type="button"
                            onPointerDown={(event) => handleAmountPointerDown(event, key)}
                            onClick={() => handleAmountClick(key)}
                            disabled={pending}
                            className="row-span-2 bg-[#e6963a] px-2 text-[1.05rem] font-black text-white transition active:bg-[#d4852c] disabled:opacity-50"
                          >
                            <span className="inline-flex flex-col items-center leading-[1.15]"><span>確</span><span>定</span></span>
                          </button>
                        )
                      }

                      const label = key === 'clear' ? 'C' : key === '-' ? '−' : key
                      const buttonClass =
                        key === 'clear'
                          ? 'bg-white text-slate-500 text-[1.1rem]'
                          : key === '-' || key === '+'
                            ? 'bg-white text-slate-500 text-[1.4rem] font-light'
                            : 'bg-white text-slate-900 text-[1.45rem]'

                      return (
                        <button
                          key={`${key}-${index}`}
                          type="button"
                          onPointerDown={(event) => handleAmountPointerDown(event, key)}
                          onClick={() => handleAmountClick(key)}
                          className={`min-h-[3.4rem] font-semibold transition active:bg-[#f0f0f0] ${buttonClass}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          className="fixed inset-x-0 z-[60] px-4"
          style={{ bottom: ACTION_FOOTER_BOTTOM_OFFSET }}
          aria-hidden={showKeypad}
        >
          <div className="mx-auto w-full max-w-md pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {renderSubmitActions()}
          </div>
        </div>
      )}
      </form>

      <CategoryPickerSheet
        open={isCategoryPickerOpen}
        categories={managedCategories}
        kind={transactionKind}
        selectedParentId={resolvedParentId}
        selectedCategoryId={resolvedCategoryId}
        onParentChange={handleParentCategoryChange}
        onCategoryChange={handleChildCategoryChange}
        onOpenSettings={openCategoryManager}
        onClose={() => setIsCategoryPickerOpen(false)}
      />

      {isMerchantPickerOpen ? (
        <MerchantPickerSheet
          open={isMerchantPickerOpen}
          merchants={managedMerchants}
          merchantGroups={managedMerchantGroups}
          value={merchant}
          onChange={setMerchant}
          onOpenSettings={openMerchantManager}
          onClose={() => setIsMerchantPickerOpen(false)}
        />
      ) : null}

      {isMerchantManagerOpen ? (
        <MerchantManagerSheet
          open={isMerchantManagerOpen}
          groups={managedMerchantGroups}
          merchants={managedMerchants}
          onGroupUpsert={handleMerchantGroupUpsert}
          onGroupArchive={handleMerchantGroupArchive}
          onMerchantUpsert={handleMerchantUpsert}
          onClose={() => setIsMerchantManagerOpen(false)}
        />
      ) : null}
    </>
  )
}
