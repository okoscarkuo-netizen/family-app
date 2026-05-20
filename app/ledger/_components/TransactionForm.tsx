'use client'

import { useEffect, useRef, useState } from 'react'
import { createTransaction } from '@/app/actions/transactions'
import {
  buildCategoryPickerGroups,
  getCategoryPath,
  type CategoryPickerGroup,
  type FamilyCategory,
  type FamilyMerchant,
  type TransactionFormPreset,
} from '@/lib/family-transactions'
import type { FamilyAccount } from '@/lib/finance/types'

type Kind = 'expense' | 'income' | 'transfer'

const KINDS: Kind[] = ['expense', 'income', 'transfer']

const KIND_LABELS: Record<Kind, string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
}

const CURRENCIES = ['TWD', 'USD', 'JPY', 'CNY'] as const
const OWNERS = ['Oscar', 'Livia'] as const
const KEYPAD_KEYS = [
  '7', '8', '9', 'backspace',
  '4', '5', '6', 'clear',
  '1', '2', '3', 'confirm',
  '.', '0', '00', 'confirm',
] as const
const WHEEL_ITEM_HEIGHT = 58
const WHEEL_VISIBLE_ROWS = 5

type Currency = (typeof CURRENCIES)[number]
type Owner = (typeof OWNERS)[number]
type KeypadKey = (typeof KEYPAD_KEYS)[number]
type PickerOption = {
  id: string
  label: string
  hint?: string
}

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'kind' | 'balance'>[]
  categories: FamilyCategory[]
  merchants: FamilyMerchant[]
  initialPreset: TransactionFormPreset | null
}

function currentLocalDateTimeValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function isKind(value: string | null | undefined): value is Kind {
  return value === 'expense' || value === 'income' || value === 'transfer'
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

function amountAccentClass(kind: Kind) {
  if (kind === 'income') return 'text-[#2aa566]'
  if (kind === 'transfer') return 'text-slate-950'
  return 'text-[#17b79c]'
}

function amountDisplayClass(kind: Kind) {
  if (kind === 'transfer') {
    return 'text-[4rem] leading-none tracking-[-0.06em]'
  }

  return 'text-[3.35rem] leading-none tracking-[-0.06em] sm:text-[3.8rem]'
}

function amountLineClass(kind: Kind) {
  if (kind === 'income') return 'bg-[#2aa566]'
  if (kind === 'transfer') return 'bg-[#f2b232]'
  return 'bg-[#17b79c]'
}

function keypadShortcutActiveClass(kind: Kind) {
  if (kind === 'income') return 'bg-[#fff2ec] text-[#d85d28] shadow-[0_14px_28px_rgba(216,93,40,0.14)]'
  if (kind === 'transfer') return 'bg-[#fff2df] text-[#d18c11] shadow-[0_14px_28px_rgba(242,178,50,0.18)]'
  return 'bg-[#ecfdf8] text-[#15957d] shadow-[0_14px_28px_rgba(21,149,125,0.14)]'
}

function pageSurfaceClass(kind: Kind) {
  if (kind === 'income') return 'from-[#fff4eb] via-white to-[#fff9f1]'
  if (kind === 'transfer') return 'from-[#fff8e9] via-white to-[#fffdf8]'
  return 'from-[#ecfdf8] via-white to-[#fff8ec]'
}

function formatAmountDisplay(amount: string) {
  if (!amount) return '0.00'

  const [rawInteger = '0', rawDecimal = ''] = amount.split('.')
  const normalizedInteger = rawInteger.replace(/^0+(?=\d)/, '') || '0'
  const formattedInteger = Number(normalizedInteger).toLocaleString('en-US')

  if (!amount.includes('.')) return `${formattedInteger}.00`
  return `${formattedInteger}.${rawDecimal.padEnd(2, '0').slice(0, 2)}`
}

function parseAmount(amount: string) {
  if (!amount) return 0
  const parsed = Number(amount)
  return Number.isFinite(parsed) ? parsed : 0
}

function appendAmountInput(current: string, value: string) {
  if (value === '.') {
    if (current.includes('.')) return current
    return current ? `${current}.` : '0.'
  }

  const next = current === '0' ? value : `${current}${value}`
  const [integer, decimal = ''] = next.split('.')
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '') || '0'
  if (decimal.length > 2) return current
  return next.includes('.') ? `${normalizedInteger}.${decimal}` : normalizedInteger
}

function removeAmountCharacter(current: string) {
  if (!current) return ''
  const trimmed = current.slice(0, -1)
  if (trimmed === '0') return ''
  if (trimmed.endsWith('.')) return trimmed
  return trimmed.replace(/^0+(?=\d)/, '') || trimmed
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
  if (kind === 'income') return '入帳帳戶'
  return '帳戶'
}

function accountFieldPlaceholder(kind: Kind) {
  if (kind === 'income') return '選擇入帳帳戶'
  return '選擇付款帳戶'
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

function buildChildOptions(group: CategoryPickerGroup | null): PickerOption[] {
  if (!group) return []
  if (group.children.length === 0) {
    return [{ id: group.parent.id, label: group.parent.name, hint: '直接使用' }]
  }

  return group.children.map((child) => ({ id: child.id, label: child.name }))
}

function cycleOption(items: PickerOption[], selectedId: string, direction: -1 | 1) {
  if (items.length === 0) return ''

  const currentIndex = Math.max(0, items.findIndex((item) => item.id === selectedId))
  const nextIndex = (currentIndex + direction + items.length) % items.length
  return items[nextIndex]?.id ?? items[0]?.id ?? ''
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
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="relative flex min-h-[4.75rem] items-center justify-between gap-4 px-5">
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
        {options.map((option) => (
          <option key={option.value || '__empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
    <label className="relative flex min-h-[4.75rem] items-center justify-between gap-4 px-5">
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
    <div className="flex min-h-[4.75rem] items-center justify-between gap-4 px-5">
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
    <div className="flex min-h-[4.75rem] items-center justify-between gap-4 px-5">
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

function TransferAccountCell({
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
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="relative flex min-h-[4.55rem] min-w-0 items-center rounded-[1.35rem] border border-[#ece4d8] bg-[#fcfbf8] px-4 pr-10">
      <div className="min-w-0">
        <div className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">{label}</div>
        <div className={`mt-1 truncate text-[1rem] font-black ${selectedValue ? 'text-slate-950' : 'text-slate-400'}`}>
          {value}
        </div>
      </div>
      <span className="pointer-events-none absolute right-3 text-lg text-slate-300">›</span>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value || '__empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TransferAccountPairRow({
  sourceValue,
  sourceSelectedValue,
  sourceOptions,
  onSourceChange,
  targetValue,
  targetSelectedValue,
  targetOptions,
  onTargetChange,
}: {
  sourceValue: string
  sourceSelectedValue: string
  sourceOptions: Array<{ value: string; label: string }>
  onSourceChange: (value: string) => void
  targetValue: string
  targetSelectedValue: string
  targetOptions: Array<{ value: string; label: string }>
  onTargetChange: (value: string) => void
}) {
  return (
    <div className="rounded-[1.6rem] border border-[#f0e8dc] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center gap-2">
        <TransferAccountCell
          label="轉出"
          value={sourceValue}
          selectedValue={sourceSelectedValue}
          onChange={onSourceChange}
          options={sourceOptions}
        />
        <div className="flex items-center justify-center text-xl font-black text-slate-300">⇄</div>
        <TransferAccountCell
          label="轉入"
          value={targetValue}
          selectedValue={targetSelectedValue}
          onChange={onTargetChange}
          options={targetOptions}
        />
      </div>
    </div>
  )
}

function TransferDateRow({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="relative flex min-h-[4.25rem] items-center justify-between gap-4 rounded-[1.35rem] border border-[#f0e8dc] bg-[#fcfbf8] px-4">
      <div className="flex items-center gap-3">
        <span className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">時間</span>
      </div>
      <span className={`truncate text-right text-[1rem] font-black ${value ? 'text-slate-950' : 'text-slate-400'}`}>
        {formatOccurredAtLabel(value)}
      </span>
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

function TransferNoteRow({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-h-[4.25rem] items-center gap-3 rounded-[1.35rem] border border-[#f0e8dc] bg-[#fcfbf8] px-4">
      <span className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">備註</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="..."
        className="min-w-0 flex-1 bg-transparent text-right text-[1rem] font-black text-slate-950 outline-none placeholder:font-bold placeholder:text-slate-300"
        aria-label="備註"
      />
    </div>
  )
}

function PickerWheel({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  items: PickerOption[]
  selectedId: string
  onSelect: (value: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || items.length === 0) return

    const selectedIndex = Math.max(0, items.findIndex((item) => item.id === selectedId))
    const targetScrollTop = selectedIndex * WHEEL_ITEM_HEIGHT
    if (Math.abs(container.scrollTop - targetScrollTop) < 4) return

    container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }, [items, selectedId])

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current != null) {
        window.clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  function handleScroll() {
    if (scrollTimeoutRef.current != null) {
      window.clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const container = containerRef.current
      if (!container || items.length === 0) return

      const nextIndex = Math.min(
        items.length - 1,
        Math.max(0, Math.round(container.scrollTop / WHEEL_ITEM_HEIGHT)),
      )
      const nextItem = items[nextIndex]
      if (!nextItem || nextItem.id === selectedId) return
      onSelect(nextItem.id)
    }, 90)
  }

  return (
    <div className="relative min-w-0">
      <div className="mb-3 px-2 text-center text-[0.7rem] font-black tracking-[0.18em] text-slate-400">
        {title}
      </div>
      <div className="relative overflow-hidden rounded-[1.5rem] bg-white/78">
        <div className="pointer-events-none absolute inset-x-3 top-1/2 z-10 h-[58px] -translate-y-1/2 rounded-[1.2rem] border border-white/85 bg-[#fff7ea]/92 shadow-[0_12px_20px_rgba(15,23,42,0.06)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-[#faf7f0] via-[#faf7f0]/92 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#faf7f0] via-[#faf7f0]/92 to-transparent" />
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="no-scrollbar snap-y snap-mandatory overflow-y-auto px-3"
          style={{
            height: `${WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS}px`,
            paddingTop: `${WHEEL_ITEM_HEIGHT * 2}px`,
            paddingBottom: `${WHEEL_ITEM_HEIGHT * 2}px`,
          }}
        >
          {items.map((item) => {
            const isActive = item.id === selectedId

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex h-[58px] w-full snap-center flex-col items-center justify-center rounded-[1.1rem] px-3 text-center transition ${
                  isActive ? 'text-slate-950' : 'text-slate-400'
                }`}
              >
                <span className="truncate text-[1rem] font-black">{item.label}</span>
                {item.hint ? (
                  <span className="mt-0.5 text-[0.68rem] font-bold tracking-[0.12em] text-slate-400">
                    {item.hint}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
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
      className="flex min-h-[4.75rem] w-full items-center justify-between gap-4 px-5 text-left"
    >
      <FieldLabel tone="bg-[#ff78a6]" label="分類" />
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 text-right">
          <div className="truncate text-[1.05rem] font-black text-slate-950">{value}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">點一下從底部選擇母分類與子分類</div>
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
  onParentStep,
  onCategoryStep,
  onClose,
}: {
  open: boolean
  categories: FamilyCategory[]
  kind: Kind
  selectedParentId: string
  selectedCategoryId: string
  onParentChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onParentStep: (direction: -1 | 1) => void
  onCategoryStep: (direction: -1 | 1) => void
  onClose: () => void
}) {
  const groups = buildCategoryPickerGroups(categories, kind)
  const selectedGroup = groups.find((group) => group.parent.id === selectedParentId) ?? groups[0] ?? null
  const selectedCategoryPath = getCategoryPath(selectedCategoryId, categories) ?? '選擇分類'
  const childOptions = buildChildOptions(selectedGroup)
  const selectedParentLabel = selectedGroup?.parent.name ?? '未選擇'
  const selectedChildLabel = childOptions.find((item) => item.id === selectedCategoryId)?.label ?? '未選擇'

  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(15,23,42,0.28)] transition ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label="關閉分類選擇"
      />
      <div
        className={`absolute inset-x-0 bottom-0 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-md rounded-t-[2.2rem] bg-[#faf7f0] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_60px_rgba(15,23,42,0.2)]">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-slate-200" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black tracking-[0.16em] text-slate-400">分類選擇</div>
              <div className="mt-2 text-xl font-black text-slate-950">{selectedCategoryPath}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-500 shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
            >
              完成
            </button>
          </div>

          <div className="mt-5 rounded-[2rem] bg-white/88 p-3 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-[1.35rem] bg-[#fff7ea] px-3 py-3">
                <div className="text-[0.68rem] font-black tracking-[0.14em] text-slate-400">母分類工具</div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{selectedParentLabel}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onParentStep(-1)}
                    className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                  >
                    上一項
                  </button>
                  <button
                    type="button"
                    onClick={() => onParentStep(1)}
                    className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                  >
                    下一項
                  </button>
                </div>
              </div>

              <div className="rounded-[1.35rem] bg-[#eef8ff] px-3 py-3">
                <div className="text-[0.68rem] font-black tracking-[0.14em] text-slate-400">子分類工具</div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{selectedChildLabel}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onCategoryStep(-1)}
                    className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                  >
                    上一項
                  </button>
                  <button
                    type="button"
                    onClick={() => onCategoryStep(1)}
                    className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                  >
                    下一項
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-start gap-2">
              <PickerWheel
                title="母分類"
                items={groups.map((group) => ({ id: group.parent.id, label: group.parent.name }))}
                selectedId={selectedGroup?.parent.id ?? ''}
                onSelect={onParentChange}
              />
              <div className="pt-[6.5rem] text-center text-2xl font-black text-slate-300">›</div>
              <PickerWheel
                title="子分類"
                items={childOptions}
                selectedId={selectedCategoryId}
                onSelect={onCategoryChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
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
      className="flex min-h-[4.75rem] w-full items-center justify-between gap-4 px-5 text-left"
    >
      <FieldLabel tone="bg-[#53d8bf]" label="商家" />
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 text-right">
          <div className={`truncate text-[1.05rem] font-black ${value ? 'text-slate-950' : 'text-slate-400'}`}>
            {value || '選擇商家'}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-400">點一下從底部輸入或選常用商家</div>
        </div>
        <span className="text-lg text-slate-300">›</span>
      </div>
    </button>
  )
}

function MerchantPickerSheet({
  open,
  value,
  onChange,
  suggestions,
  onClose,
}: {
  open: boolean
  value: string
  onChange: (value: string) => void
  suggestions: FamilyMerchant[]
  onClose: () => void
}) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(15,23,42,0.28)] transition ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label="關閉商家選擇"
      />
      <div
        className={`absolute inset-x-0 bottom-0 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-md rounded-t-[2.2rem] bg-[#faf7f0] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_60px_rgba(15,23,42,0.2)]">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-slate-200" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black tracking-[0.16em] text-slate-400">商家選擇</div>
              <div className="mt-2 text-xl font-black text-slate-950">{value.trim() || '輸入商家或直接選擇'}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-500 shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
            >
              完成
            </button>
          </div>

          <div className="mt-5 rounded-[2rem] bg-white/88 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="商家或對象（選填）"
              className="w-full rounded-[1.25rem] border border-[#ece6dc] bg-[#fcfbf8] px-4 py-4 text-[1.05rem] font-black text-slate-950 outline-none placeholder:font-bold placeholder:text-slate-300"
              aria-label="商家"
            />

            {suggestions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((merchant) => (
                  <button
                    key={merchant.id}
                    type="button"
                    onClick={() => onChange(merchant.name)}
                    className={`rounded-full border px-3 py-2 text-sm font-black transition ${
                      merchant.name === value.trim()
                        ? 'border-[#1ab697] bg-[#ecfdf8] text-[#16927a]'
                        : 'border-[#ebe5db] bg-[#fcfbf8] text-slate-500'
                    }`}
                  >
                    {merchant.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm font-bold text-slate-400">目前還沒有可選的常用商家</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TransactionForm({ accounts, categories, merchants, initialPreset }: Props) {
  const initialKind = isKind(initialPreset?.kind) ? initialPreset.kind : 'expense'
  const initialCategorySelection = resolveCategorySelection(
    buildCategoryPickerGroups(categories, initialKind),
    initialPreset?.categoryId,
  )
  const formRef = useRef<HTMLFormElement>(null)
  const kindCarouselRef = useRef<HTMLDivElement>(null)
  const swipeSyncTimeoutRef = useRef<number | null>(null)
  const [kind, setKind] = useState<Kind>(initialKind)
  const [pending, setPending] = useState(false)
  const [amount, setAmount] = useState('')
  const [isKeypadVisible, setIsKeypadVisible] = useState(false)
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false)
  const [isMerchantPickerOpen, setIsMerchantPickerOpen] = useState(false)
  const [currency, setCurrency] = useState<Currency>(isCurrency(initialPreset?.currency) ? initialPreset.currency : 'TWD')
  const [categoryId, setCategoryId] = useState(initialCategorySelection.categoryId)
  const [accountId, setAccountId] = useState(initialPreset?.accountId ?? '')
  const [toAccountId, setToAccountId] = useState(initialPreset?.toAccountId ?? '')
  const [merchant, setMerchant] = useState('')
  const [occurredAt, setOccurredAt] = useState(currentLocalDateTimeValue)
  const [owner, setOwner] = useState<Owner>(isOwner(initialPreset?.owner) ? initialPreset.owner : 'Oscar')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const categoryGroups = buildCategoryPickerGroups(categories, kind)
  const resolvedCategorySelection = resolveCategorySelection(categoryGroups, categoryId)
  const resolvedParentId = resolvedCategorySelection.parentId
  const resolvedCategoryId = resolvedCategorySelection.categoryId
  const resolvedAccountId = accounts.some((account) => account.id === accountId) ? accountId : ''
  const resolvedToAccountId = accounts.some((account) => account.id === toAccountId) ? toAccountId : ''
  const selectedCategory = categories.find((category) => category.id === resolvedCategoryId) ?? null
  const selectedAccount = accounts.find((account) => account.id === resolvedAccountId) ?? null
  const selectedToAccount = accounts.find((account) => account.id === resolvedToAccountId) ?? null
  const merchantQuery = merchant.trim().toLocaleLowerCase('zh-TW')
  const merchantSuggestions = merchants
    .filter((item) => {
      if (!merchantQuery) return true
      return item.name.toLocaleLowerCase('zh-TW').includes(merchantQuery)
    })
    .filter((item) => item.name !== merchant.trim())
    .slice(0, merchantQuery ? 6 : 8)
  const amountValue = parseAmount(amount)
  const canSubmit = amountValue > 0 && Boolean(resolvedAccountId) && (kind !== 'transfer' || Boolean(resolvedToAccountId))

  useEffect(() => {
    const container = kindCarouselRef.current
    if (!container) return

    const index = KINDS.indexOf(kind)
    const card = container.children.item(index) as HTMLElement | null
    if (!card) return

    const targetLeft = card.offsetLeft
    if (Math.abs(container.scrollLeft - targetLeft) < 4) return
    container.scrollTo({ left: targetLeft, behavior: 'smooth' })
  }, [kind])

  useEffect(() => {
    return () => {
      if (swipeSyncTimeoutRef.current != null) {
        window.clearTimeout(swipeSyncTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isCategoryPickerOpen && !isMerchantPickerOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isCategoryPickerOpen, isMerchantPickerOpen])

  async function handleSubmit(formData: FormData) {
    if (!canSubmit) return

    setMessage(null)
    formData.set('amount', String(amountValue))
    formData.set('kind', kind)
    formData.set('currency', currency)
    formData.set('category_id', resolvedCategoryId)
    formData.set('account_id', resolvedAccountId)
    formData.set('to_account_id', kind === 'transfer' ? resolvedToAccountId : '')
    formData.set('merchant', merchant)
    formData.set('occurred_at', occurredAt)
    formData.set('owner', owner)
    formData.set('note', note)
    if (selectedCategory) formData.set('category_name', selectedCategory.name)

    setPending(true)
    try {
      const result = await createTransaction(formData)
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        return
      }

      setAmount('')
      setMerchant('')
      setNote('')
      setOccurredAt(currentLocalDateTimeValue())
      setMessage({ tone: 'success', text: '已儲存，沿用上一筆的分類、帳戶、成員與幣別。' })
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '新增失敗，請稍後再試。',
      })
    } finally {
      setPending(false)
    }
  }

  function updateKind(nextKind: Kind) {
    if (nextKind === kind) return
    const nextCategorySelection = resolveCategorySelection(
      buildCategoryPickerGroups(categories, nextKind),
      '',
    )
    setKind(nextKind)
    setCategoryId(nextCategorySelection.categoryId)
    if (nextKind !== 'transfer') {
      setToAccountId('')
    }
  }

  function handleParentCategoryChange(parentId: string) {
    const nextGroup = categoryGroups.find((group) => group.parent.id === parentId)
    if (!nextGroup) return

    setCategoryId(nextGroup.children[0]?.id ?? nextGroup.parent.id)
  }

  function handleChildCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
  }

  function handleParentCategoryStep(direction: -1 | 1) {
    const parentOptions = categoryGroups.map((group) => ({ id: group.parent.id, label: group.parent.name }))
    const nextParentId = cycleOption(parentOptions, resolvedParentId, direction)
    if (nextParentId) {
      handleParentCategoryChange(nextParentId)
    }
  }

  function handleChildCategoryStep(direction: -1 | 1) {
    const selectedGroup = categoryGroups.find((group) => group.parent.id === resolvedParentId) ?? categoryGroups[0] ?? null
    const childOptions = buildChildOptions(selectedGroup)
    const nextCategoryId = cycleOption(childOptions, resolvedCategoryId, direction)
    if (nextCategoryId) {
      handleChildCategoryChange(nextCategoryId)
    }
  }

  function openCategoryPicker() {
    setIsMerchantPickerOpen(false)
    setIsKeypadVisible(false)
    setIsCategoryPickerOpen(true)
  }

  function openMerchantPicker() {
    setIsCategoryPickerOpen(false)
    setIsKeypadVisible(false)
    setIsMerchantPickerOpen(true)
  }

  function handleKindCarouselScroll() {
    if (swipeSyncTimeoutRef.current != null) {
      window.clearTimeout(swipeSyncTimeoutRef.current)
    }

    swipeSyncTimeoutRef.current = window.setTimeout(() => {
      const container = kindCarouselRef.current
      if (!container) return

      let closestKind = kind
      let closestDistance = Number.POSITIVE_INFINITY

      KINDS.forEach((item, index) => {
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

  function handleAmountKey(key: KeypadKey) {
    if (pending) return

    if (key === 'confirm') {
      setIsKeypadVisible(false)
      return
    }

    if (key === 'clear') {
      setAmount('')
      return
    }

    if (key === 'backspace') {
      setAmount((current) => removeAmountCharacter(current))
      return
    }

    setAmount((current) => appendAmountInput(current, key))
  }

  function renderEntryPage(pageKind: Kind) {
    const pageCategoryGroups = buildCategoryPickerGroups(categories, pageKind)
    const pageCategorySelection = resolveCategorySelection(
      pageCategoryGroups,
      pageKind === kind ? categoryId : '',
    )
    const pageCategoryPath = getCategoryPath(pageCategorySelection.categoryId, categories) ?? '選擇分類'
    const pageSelectedCategory = categories.find((category) => category.id === pageCategorySelection.categoryId) ?? null

    if (pageKind === 'transfer') {
      return (
        <article
          key={pageKind}
          className="w-full shrink-0 snap-center"
          aria-label={`${KIND_LABELS[pageKind]} 頁`}
        >
          <section className="overflow-hidden rounded-[2rem] bg-white px-4 pb-5 pt-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
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

            <div className={`mt-4 h-1 rounded-full ${amountLineClass(pageKind)}`} />

            <div className="mt-5 space-y-3">
              <TransferAccountPairRow
                sourceValue={selectedAccount ? formatAccountLabel(selectedAccount) : '選擇來源帳戶'}
                sourceSelectedValue={resolvedAccountId}
                sourceOptions={[
                  { value: '', label: '選擇來源帳戶' },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: formatAccountLabel(account),
                  })),
                ]}
                onSourceChange={setAccountId}
                targetValue={selectedToAccount ? formatAccountLabel(selectedToAccount) : '選擇目標帳戶'}
                targetSelectedValue={resolvedToAccountId}
                targetOptions={[
                  { value: '', label: '選擇目標帳戶' },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: formatAccountLabel(account),
                  })),
                ]}
                onTargetChange={setToAccountId}
              />

              <TransferDateRow value={occurredAt} onChange={setOccurredAt} />
              <TransferNoteRow value={note} onChange={setNote} />
            </div>
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
        <section className={`overflow-hidden rounded-[2rem] bg-gradient-to-br px-5 pb-5 pt-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] ${pageSurfaceClass(pageKind)}`}>
          <div className="flex items-start justify-between gap-4">
            <div aria-hidden="true" />

            <div className="text-right">
              <label className="relative inline-flex items-center gap-2 rounded-full bg-white/88 px-4 py-2 text-sm font-black text-slate-600 shadow-[0_10px_20px_rgba(15,23,42,0.06)]">
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
          </div>

          <button
            type="button"
            onClick={() => {
              if (pageKind !== kind) updateKind(pageKind)
              setIsKeypadVisible(true)
            }}
            className={`mt-8 block w-full text-left font-black ${amountDisplayClass(pageKind)} ${amountAccentClass(pageKind)}`}
            aria-label={`開啟${KIND_LABELS[pageKind]}數字鍵盤`}
          >
            {formatAmountDisplay(amount)}
          </button>
          <div className={`mt-4 h-1 rounded-full ${amountLineClass(pageKind)}`} />
        </section>

        <section className="mt-4 overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <CategoryFieldRow
            value={pageSelectedCategory ? getCategoryPath(pageSelectedCategory.id, categories) ?? pageCategoryPath : pageCategoryPath}
            onOpen={openCategoryPicker}
          />
          <div className="mx-5 h-px bg-[#efebe4]" />
          <SelectFieldRow
            tone="bg-[#f0b542]"
            label={accountFieldLabel(pageKind)}
            value={selectedAccount ? formatAccountLabel(selectedAccount) : accountFieldPlaceholder(pageKind)}
            selectedValue={resolvedAccountId}
            onChange={setAccountId}
            options={[
              { value: '', label: accountFieldPlaceholder(pageKind) },
              ...accounts.map((account) => ({
                value: account.id,
                label: formatAccountLabel(account),
              })),
            ]}
          />

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
        </section>
      </article>
    )
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className={isKeypadVisible ? 'pb-[calc(24rem+7rem+env(safe-area-inset-bottom))]' : 'pb-[calc(7rem+env(safe-area-inset-bottom))]'}
    >
      <div className="sticky top-0 z-30 bg-[#faf7f0]/92 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <div className="w-16" />
          <h1 className="text-lg font-black tracking-[0.02em] text-slate-950">記一筆</h1>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={pending || !canSubmit}
            className="w-16 text-right text-base font-black text-[#f2b232] disabled:text-slate-300"
          >
            {pending ? '保存中' : '保存'}
          </button>
        </div>

        <div className="mx-auto mt-3 grid w-full max-w-md grid-cols-3 border-b border-[#ece4d8] px-1">
          {KINDS.map((item) => {
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
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {KINDS.map((item) => renderEntryPage(item))}
        </div>
      </div>

      <CategoryPickerSheet
        open={isCategoryPickerOpen}
        categories={categories}
        kind={kind}
        selectedParentId={resolvedParentId}
        selectedCategoryId={resolvedCategoryId}
        onParentChange={handleParentCategoryChange}
        onCategoryChange={handleChildCategoryChange}
        onParentStep={handleParentCategoryStep}
        onCategoryStep={handleChildCategoryStep}
        onClose={() => setIsCategoryPickerOpen(false)}
      />

      <MerchantPickerSheet
        open={isMerchantPickerOpen}
        value={merchant}
        onChange={setMerchant}
        suggestions={merchantSuggestions}
        onClose={() => setIsMerchantPickerOpen(false)}
      />

      <div
        className={`fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-40 px-4 transition-all ${
          isKeypadVisible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
        }`}
        aria-hidden={!isKeypadVisible}
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <div className="rounded-[2rem] bg-white/92 p-3 shadow-[0_24px_55px_rgba(15,23,42,0.15)] backdrop-blur">
            <div className="flex items-stretch gap-2">
              <div className="grid w-[4.7rem] shrink-0 grid-rows-3 gap-2">
                {KINDS.map((item) => {
                  const isActive = kind === item
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => updateKind(item)}
                      aria-pressed={isActive}
                      className={`flex min-h-[5.75rem] items-center justify-center rounded-[1.35rem] border text-[1.05rem] font-black tracking-[0.08em] transition active:scale-[0.98] ${
                        isActive
                          ? `border-transparent ${keypadShortcutActiveClass(item)}`
                          : 'border-[#ece6dc] bg-[#fcfbf8] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
                      }`}
                    >
                      <span style={{ writingMode: 'vertical-rl' }}>{KIND_LABELS[item]}</span>
                    </button>
                  )
                })}
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-4 gap-2">
                {KEYPAD_KEYS.map((key, index) => {
                  if (key === 'confirm' && index === 15) return null

                  if (key === 'confirm') {
                    return (
                      <button
                        key={`${key}-${index}`}
                        type="button"
                        onClick={() => handleAmountKey(key)}
                        disabled={pending}
                        className="row-span-2 rounded-[1.4rem] bg-[linear-gradient(180deg,#ffbd59_0%,#ff9d2f_100%)] px-3 py-6 text-lg font-black text-white shadow-[0_14px_28px_rgba(255,157,47,0.38)] disabled:opacity-50"
                      >
                        確定
                      </button>
                    )
                  }

                  const label = key === 'backspace' ? '⌫' : key === 'clear' ? 'C' : key
                  const buttonClass =
                    key === 'backspace' || key === 'clear'
                      ? 'bg-[#f6f2eb] text-slate-700'
                      : 'bg-[#fcfbf8] text-slate-950'

                  return (
                    <button
                      key={`${key}-${index}`}
                      type="button"
                      onClick={() => handleAmountKey(key)}
                      className={`min-h-[4.25rem] rounded-[1.35rem] text-2xl font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition active:scale-[0.98] ${buttonClass}`}
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
    </form>
  )
}
