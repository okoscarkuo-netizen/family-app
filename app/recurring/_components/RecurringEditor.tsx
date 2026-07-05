'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateRecurringTransaction } from '@/app/actions/recurring'
import type { Frequency, RecurringTransaction } from '@/lib/recurring-db'
import type { FamilyAccount } from '@/lib/finance/types'

type AccountOption = Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'owner' | 'shared' | 'favorite'>
type CategoryOption = {
  id: string
  kind: 'income' | 'expense' | 'transfer'
  label: string
}
type MerchantOption = {
  id: string
  name: string
}

const KIND_OPTIONS = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
  { value: 'transfer', label: '轉帳' },
] as const

const CURRENCY_OPTIONS = ['TWD', 'USD', 'JPY'] as const

const FREQUENCY_OPTIONS: Array<{ value: Frequency; label: string }> = [
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季' },
  { value: 'yearly', label: '每年' },
]

function formatAccountLabel(account: AccountOption) {
  const ownerLabel = account.shared ? '共用' : account.owner
  return `${account.name} · ${account.currency} · ${ownerLabel}`
}

function parsePositiveNumber(input: string) {
  const value = Number.parseFloat(input)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function RecurringEditor({
  recurring,
  accounts,
  categories,
  merchants,
}: {
  recurring: RecurringTransaction
  accounts: AccountOption[]
  categories: CategoryOption[]
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [kind, setKind] = useState<RecurringTransaction['kind']>(recurring.kind)
  const [name, setName] = useState(recurring.name)
  const [amountInput, setAmountInput] = useState(String(recurring.amount))
  const [currency, setCurrency] = useState(recurring.currency)
  const [accountId, setAccountId] = useState(recurring.accountId)
  const [targetAccountId, setTargetAccountId] = useState(recurring.targetAccountId ?? '')
  const [targetAmountInput, setTargetAmountInput] = useState(
    recurring.targetAmount == null ? String(recurring.amount) : String(recurring.targetAmount),
  )
  const [targetCurrency, setTargetCurrency] = useState(recurring.targetCurrency ?? recurring.currency)
  const [categoryId, setCategoryId] = useState(recurring.categoryId ?? '')
  const [merchantId, setMerchantId] = useState(recurring.merchantId ?? '')
  const [owner, setOwner] = useState<'Oscar' | 'Livia'>(recurring.owner)
  const [frequency, setFrequency] = useState<Frequency>(recurring.frequency)
  const [nextDueDate, setNextDueDate] = useState(recurring.nextDueDate)
  const [endType, setEndType] = useState<'forever' | 'count'>(recurring.endType)
  const [endCountInput, setEndCountInput] = useState(String(recurring.endCount ?? 12))
  const [notes, setNotes] = useState(recurring.notes ?? '')
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  )

  const canSubmit = Boolean(name.trim()) && Boolean(accountId) && (kind !== 'transfer' || Boolean(targetAccountId))

  function handleSubmit() {
    setMessage(null)

    const amount = parsePositiveNumber(amountInput)
    if (amount == null) {
      setMessage({ tone: 'error', text: '請輸入大於 0 的金額。' })
      return
    }

    const resolvedTargetAmount = kind === 'transfer'
      ? parsePositiveNumber(targetAmountInput) ?? amount
      : null

    if (kind === 'transfer' && !targetAccountId) {
      setMessage({ tone: 'error', text: '轉帳要選轉入帳戶。' })
      return
    }

    startTransition(async () => {
      const result = await updateRecurringTransaction(recurring.id, {
        name: name.trim(),
        kind,
        amount,
        currency,
        accountId,
        targetAccountId: kind === 'transfer' ? targetAccountId || null : null,
        targetAmount: resolvedTargetAmount,
        targetCurrency: kind === 'transfer' ? (targetCurrency || currency) : null,
        categoryId: kind === 'transfer' ? null : categoryId || null,
        merchantId: merchantId || null,
        owner,
        frequency,
        startDate: recurring.startDate,
        nextDueDate,
        endType,
        endCount: endType === 'count' ? Math.max(1, Number.parseInt(endCountInput || '1', 10) || 1) : null,
        notes: notes.trim() ? notes.trim() : null,
      })

      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        return
      }

      setMessage({ tone: 'success', text: '定期交易已更新。' })
      router.push('/recurring')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 p-4 pb-8">
      <section className="rounded-[1.2rem] border border-[#ece4d8] bg-[#fffdf8] p-4">
        <div className="text-[0.78rem] font-bold text-slate-500">目前狀態</div>
        <div className="mt-2 text-[0.95rem] font-black text-slate-900">
          下次 {recurring.nextDueDate} ・ 已記 {recurring.generatedCount} 筆
        </div>
      </section>

      <section className="space-y-4 rounded-[1.2rem] border border-[#ece4d8] bg-white p-4">
        <Field label="類型">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as RecurringTransaction['kind'])}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>

        <Field label="名稱">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            placeholder="例如：房租、Spotify、薪水"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="金額">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            />
          </Field>
          <Field label="幣別">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={kind === 'transfer' ? '轉出帳戶' : '帳戶'}>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
          >
            <option value="">請選帳戶</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{formatAccountLabel(account)}</option>
            ))}
          </select>
        </Field>

        {kind === 'transfer' ? (
          <>
            <Field label="轉入帳戶">
              <select
                value={targetAccountId}
                onChange={(event) => setTargetAccountId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
              >
                <option value="">請選轉入帳戶</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{formatAccountLabel(account)}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="轉入金額">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={targetAmountInput}
                  onChange={(event) => setTargetAmountInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
                />
              </Field>
              <Field label="轉入幣別">
                <select
                  value={targetCurrency}
                  onChange={(event) => setTargetCurrency(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="分類">
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
              >
                <option value="">不指定分類</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </Field>

            <Field label="商家">
              <select
                value={merchantId}
                onChange={(event) => setMerchantId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
              >
                <option value="">不指定商家</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="擁有者">
            <select
              value={owner}
              onChange={(event) => setOwner(event.target.value as 'Oscar' | 'Livia')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            >
              <option value="Oscar">Oscar</option>
              <option value="Livia">Livia</option>
            </select>
          </Field>
          <Field label="頻率">
            <select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as Frequency)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="下次日期">
            <input
              type="date"
              value={nextDueDate}
              onChange={(event) => setNextDueDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            />
          </Field>
          <Field label="結束方式">
            <select
              value={endType}
              onChange={(event) => setEndType(event.target.value as 'forever' | 'count')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            >
              <option value="forever">一直重複</option>
              <option value="count">固定次數</option>
            </select>
          </Field>
        </div>

        {endType === 'count' ? (
          <Field label="共幾次">
            <input
              type="number"
              min="1"
              value={endCountInput}
              onChange={(event) => {
                const nextValue = event.target.value
                if (/^\d*$/.test(nextValue)) setEndCountInput(nextValue)
              }}
              onBlur={() => {
                if (!endCountInput) setEndCountInput('1')
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            />
          </Field>
        ) : null}

        <Field label="備註">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[0.95rem] font-bold text-slate-900"
            placeholder="可留空"
          />
        </Field>
      </section>

      {message ? (
        <div
          className={`rounded-[1rem] px-4 py-3 text-[0.85rem] font-bold ${
            message.tone === 'error' ? 'bg-[#fff1ee] text-[#c9563f]' : 'bg-[#e6f5ec] text-[#187d5f]'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => router.push('/recurring')}
          className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-[0.95rem] font-black text-slate-700"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || pending}
          className="rounded-[1rem] bg-slate-900 px-4 py-3 text-[0.95rem] font-black text-white disabled:opacity-50"
        >
          {pending ? '儲存中...' : '儲存'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-2">
      <div className="text-[0.78rem] font-bold text-slate-500">{label}</div>
      {children}
    </label>
  )
}
