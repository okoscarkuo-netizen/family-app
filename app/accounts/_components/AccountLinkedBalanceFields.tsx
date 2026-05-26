'use client'

import { useEffect, useMemo, useState } from 'react'
import { inputClass } from '@/components/PageShell'

type PairState = 'empty' | 'valid' | 'invalid'

type Props = {
  balance: number
  openingBalance?: number
  ledgerDelta: number
  balanceDate?: string | null
  currentLabel?: string
  openingLabel?: string
  reconcileLabel?: string
  compact?: boolean
  onValidityChange?: (valid: boolean) => void
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function safeAmount(value: unknown, fallback = 0) {
  const amount = Number(value)
  return Number.isFinite(amount) ? roundAmount(amount) : fallback
}

function inputValue(value: number) {
  return String(roundAmount(value))
}

function formatAmount(value: number) {
  return roundAmount(value).toLocaleString('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseInput(value: string) {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function AccountLinkedBalanceFields({
  balance,
  ledgerDelta,
  balanceDate,
  openingLabel = '初始金額',
  reconcileLabel = '對帳差額',
  onValidityChange,
}: Props) {
  const safeLedgerDelta = useMemo(() => safeAmount(ledgerDelta), [ledgerDelta])
  const safeBalance = safeAmount(balance)

  const [balanceValue, setBalanceValue] = useState(() => inputValue(safeBalance))
  const [dateValue, setDateValue] = useState(balanceDate ?? '')
  const [openingValue, setOpeningValue] = useState(() => inputValue(0))

  const parsedBalance = parseInput(balanceValue)
  const parsedOpeningBalance = parseInput(openingValue)

  const pairState: PairState =
    balanceValue.trim() !== '' && dateValue !== '' ? 'valid' :
    balanceValue.trim() === '' && dateValue === '' ? 'empty' :
    'invalid'

  const isPairValid = pairState === 'valid'

  useEffect(() => {
    onValidityChange?.(isPairValid)
  }, [isPairValid, onValidityChange])

  const reconcileDifference =
    parsedBalance !== null && parsedOpeningBalance !== null
      ? roundAmount(parsedBalance - parsedOpeningBalance - safeLedgerDelta)
      : null

  const pairBorderClass =
    pairState === 'valid' ? 'border-[#c5e8de] bg-[#f4fffb]' :
    'border-[#f2c7bf] bg-[#fff6f4]'

  return (
    <div className="space-y-3">

      {/* 確認餘額群組 — balance + date 必須同時填或同時空 */}
      <div className={`rounded-[1.1rem] border-2 px-3 py-3 transition-colors ${pairBorderClass}`}>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs font-black text-slate-600">確認餘額</p>
          {pairState === 'valid' ? (
            <span className="rounded-full bg-[#d9f0e8] px-2 py-0.5 text-[0.65rem] font-black text-[#15957d]">
              已設定
            </span>
          ) : (
            <span className="rounded-full bg-[#fde8e4] px-2 py-0.5 text-[0.65rem] font-black text-[#c9563f]">
              必填
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[0.7rem] font-bold text-slate-500">金額</span>
            <input
              name="balance"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={balanceValue}
              onChange={(e) => setBalanceValue(e.target.value)}
              placeholder="0.00"
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="block">
            <span className="text-[0.7rem] font-bold text-slate-500">確認日期</span>
            <input
              name="balance_date"
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        </div>

        {pairState !== 'valid' && (
          <p className="mt-2 text-[0.7rem] font-bold text-[#c9563f]">
            {pairState === 'invalid' ? '金額與確認日期必須同時填寫' : '請填寫金額與確認日期'}
          </p>
        )}
        {pairState === 'valid' && (
          <p className="mt-2 text-[0.68rem] font-medium text-[#15957d]">
            這個日期以前補記的交易不會影響餘額
          </p>
        )}
      </div>

      {/* 初始金額 */}
      <label className="block">
        <span className="text-xs font-black text-slate-600">{openingLabel}</span>
        <input
          name="opening_balance"
          type="number"
          step="0.01"
          inputMode="decimal"
          value={openingValue}
          onChange={(e) => setOpeningValue(e.target.value)}
          className={`mt-1 ${inputClass}`}
        />
      </label>

      {/* 對帳差額 */}
      <div
        className={`rounded-[1rem] border px-3 py-2 ${
          reconcileDifference === null
            ? 'border-[#ece4d8] bg-[#fbfaf7]'
            : Math.abs(reconcileDifference) < 0.005
              ? 'border-[#d9efe8] bg-[#f4fffb]'
              : 'border-[#f2c7bf] bg-[#fff6f4]'
        }`}
      >
        <p className="text-[0.68rem] font-black text-slate-400">{reconcileLabel}</p>
        <p
          className={`mt-0.5 text-base font-black ${
            reconcileDifference === null
              ? 'text-slate-400'
              : Math.abs(reconcileDifference) < 0.005
                ? 'text-[#15957d]'
                : 'text-[#c9563f]'
          }`}
        >
          {reconcileDifference === null ? '—' : formatAmount(reconcileDifference)}
        </p>
        <p className="mt-0.5 text-[0.66rem] font-bold text-slate-400">
          公式：目前金額 - 初始金額 - 交易合計
        </p>
      </div>
    </div>
  )
}
