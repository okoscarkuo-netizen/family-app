'use client'

import { useRef, useState } from 'react'
import { createTransaction } from '@/app/actions/transactions'
import type { FamilyCategory, TransactionFormPreset } from '@/lib/family-transactions'
import type { FamilyAccount } from '@/lib/finance/types'

type Kind = 'expense' | 'income' | 'transfer'

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

type Currency = (typeof CURRENCIES)[number]
type Owner = (typeof OWNERS)[number]
type KeypadKey = (typeof KEYPAD_KEYS)[number]

type Props = {
  accounts: Pick<FamilyAccount, 'id' | 'name' | 'currency'>[]
  categories: FamilyCategory[]
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
  if (kind === 'transfer') return 'text-[#2f6df6]'
  return 'text-[#17b79c]'
}

function amountLineClass(kind: Kind) {
  if (kind === 'income') return 'bg-[#2aa566]'
  if (kind === 'transfer') return 'bg-[#2f6df6]'
  return 'bg-[#17b79c]'
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

export function TransactionForm({ accounts, categories, initialPreset }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [kind, setKind] = useState<Kind>(isKind(initialPreset?.kind) ? initialPreset.kind : 'expense')
  const [pending, setPending] = useState(false)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(isCurrency(initialPreset?.currency) ? initialPreset.currency : 'TWD')
  const [categoryId, setCategoryId] = useState(initialPreset?.categoryId ?? '')
  const [accountId, setAccountId] = useState(initialPreset?.accountId ?? '')
  const [toAccountId, setToAccountId] = useState(initialPreset?.toAccountId ?? '')
  const [merchant, setMerchant] = useState('')
  const [occurredAt, setOccurredAt] = useState(currentLocalDateTimeValue)
  const [owner, setOwner] = useState<Owner>(isOwner(initialPreset?.owner) ? initialPreset.owner : 'Oscar')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const filteredCategories = categories.filter((category) => category.kind === kind)
  const resolvedCategoryId = filteredCategories.some((category) => category.id === categoryId) ? categoryId : ''
  const resolvedAccountId = accounts.some((account) => account.id === accountId) ? accountId : ''
  const resolvedToAccountId = accounts.some((account) => account.id === toAccountId) ? toAccountId : ''
  const selectedCategory = filteredCategories.find((category) => category.id === resolvedCategoryId) ?? null
  const selectedAccount = accounts.find((account) => account.id === resolvedAccountId) ?? null
  const selectedToAccount = accounts.find((account) => account.id === resolvedToAccountId) ?? null
  const amountValue = parseAmount(amount)
  const canSubmit = amountValue > 0 && Boolean(resolvedAccountId) && (kind !== 'transfer' || Boolean(resolvedToAccountId))

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
      await createTransaction(formData)
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
    setKind(nextKind)
    setCategoryId('')
    if (nextKind !== 'transfer') {
      setToAccountId('')
    }
  }

  function handleAmountKey(key: KeypadKey) {
    if (pending) return

    if (key === 'confirm') {
      if (canSubmit) formRef.current?.requestSubmit()
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

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="pb-[calc(24rem+7rem+env(safe-area-inset-bottom))]"
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

        <div className="mx-auto mt-4 flex w-full max-w-md items-center rounded-full bg-white/88 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          {(['expense', 'income', 'transfer'] as Kind[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => updateKind(item)}
              className={`relative flex-1 rounded-full px-2 py-3 text-sm font-black transition ${
                kind === item ? 'bg-[#fff4df] text-[#d18c11]' : 'text-slate-400'
              }`}
            >
              {KIND_LABELS[item]}
              {kind === item ? (
                <span className="absolute inset-x-6 bottom-1 h-1 rounded-full bg-[#f2b232]" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4">
        <section className="overflow-hidden rounded-[2rem] bg-white px-5 pb-5 pt-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <label className="relative inline-flex items-center gap-2 rounded-full bg-[#f5f8fb] px-4 py-2 text-sm font-black text-slate-600">
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
            <div className="rounded-2xl bg-[#faf7f0] px-4 py-3 text-right shadow-[0_10px_20px_rgba(15,23,42,0.06)]">
              <div className="text-xs font-bold tracking-[0.18em] text-slate-400">快速記帳</div>
              <div className="mt-1 text-sm font-black text-slate-500">用底部數字鍵盤輸入</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAmount('')}
            className={`mt-5 block w-full text-left text-[4rem] font-black leading-none tracking-[-0.04em] ${amountAccentClass(kind)}`}
            aria-label="清除金額"
          >
            {formatAmountDisplay(amount)}
          </button>
          <div className={`mt-4 h-1 rounded-full ${amountLineClass(kind)}`} />
        </section>

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

        <section className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <SelectFieldRow
            tone="bg-[#ff78a6]"
            label="分類"
            value={selectedCategory?.name ?? '選擇分類'}
            selectedValue={resolvedCategoryId}
            onChange={setCategoryId}
            options={[
              { value: '', label: '選擇分類' },
              ...filteredCategories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
          />
          <div className="mx-5 h-px bg-[#efebe4]" />

          {kind === 'transfer' ? (
            <>
              <SelectFieldRow
                tone="bg-[#f0b542]"
                label="轉出帳戶"
                value={selectedAccount ? formatAccountLabel(selectedAccount) : '選擇來源帳戶'}
                selectedValue={resolvedAccountId}
                onChange={setAccountId}
                options={[
                  { value: '', label: '選擇來源帳戶' },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: formatAccountLabel(account),
                  })),
                ]}
              />
              <div className="mx-5 h-px bg-[#efebe4]" />
              <SelectFieldRow
                tone="bg-[#68a7ff]"
                label="轉入帳戶"
                value={selectedToAccount ? formatAccountLabel(selectedToAccount) : '選擇目標帳戶'}
                selectedValue={resolvedToAccountId}
                onChange={setToAccountId}
                options={[
                  { value: '', label: '選擇目標帳戶' },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: formatAccountLabel(account),
                  })),
                ]}
              />
            </>
          ) : (
            <SelectFieldRow
              tone="bg-[#f0b542]"
              label="帳戶"
              value={selectedAccount ? formatAccountLabel(selectedAccount) : '選擇付款帳戶'}
              selectedValue={resolvedAccountId}
              onChange={setAccountId}
              options={[
                { value: '', label: '選擇付款帳戶' },
                ...accounts.map((account) => ({
                  value: account.id,
                  label: formatAccountLabel(account),
                })),
              ]}
            />
          )}

          <div className="mx-5 h-px bg-[#efebe4]" />
          <DateFieldRow value={occurredAt} onChange={setOccurredAt} />
          <div className="mx-5 h-px bg-[#efebe4]" />
          <OwnerFieldRow owner={owner} onChange={setOwner} />
          <div className="mx-5 h-px bg-[#efebe4]" />
          <TextFieldRow
            tone="bg-[#53d8bf]"
            label="商家"
            placeholder="商家或對象（選填）"
            value={merchant}
            onChange={setMerchant}
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
      </div>

      <div className="fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-40 px-4">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <div className="rounded-[2rem] bg-white/92 p-3 shadow-[0_24px_55px_rgba(15,23,42,0.15)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-black tracking-[0.16em] text-slate-400">數字鍵盤</span>
              <span className={`text-sm font-black ${amountAccentClass(kind)}`}>
                {amountValue > 0 ? `${currency} ${formatAmountDisplay(amount)}` : `${currency} 0.00`}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {KEYPAD_KEYS.map((key, index) => {
                if (key === 'confirm' && index === 15) return null

                if (key === 'confirm') {
                  return (
                    <button
                      key={`${key}-${index}`}
                      type="button"
                      onClick={() => handleAmountKey(key)}
                      disabled={pending || !canSubmit}
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
    </form>
  )
}
