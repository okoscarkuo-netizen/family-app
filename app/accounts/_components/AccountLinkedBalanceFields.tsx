'use client'

import { useMemo, useState } from 'react'
import { inputClass } from '@/components/PageShell'

type Props = {
  balance: number
  openingBalance?: number
  ledgerDelta: number
  currentLabel?: string
  openingLabel?: string
  reconcileLabel?: string
  compact?: boolean
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
  currentLabel = '目前金額',
  openingLabel = '初始金額',
  reconcileLabel = '對帳差額',
  compact = false,
}: Props) {
  const safeLedgerDelta = useMemo(() => safeAmount(ledgerDelta), [ledgerDelta])
  const safeBalance = safeAmount(balance)
  const [balanceValue, setBalanceValue] = useState(() => inputValue(safeBalance))
  const [openingValue, setOpeningValue] = useState(() => inputValue(0))
  const parsedBalance = parseInput(balanceValue)
  const parsedOpeningBalance = parseInput(openingValue)
  const reconcileDifference =
    parsedBalance !== null && parsedOpeningBalance !== null
      ? roundAmount(parsedBalance - parsedOpeningBalance - safeLedgerDelta)
      : null

  function handleBalanceChange(value: string) {
    setBalanceValue(value)
  }

  function handleOpeningBalanceChange(value: string) {
    setOpeningValue(value)
  }

  return (
    <div className="space-y-3">
      <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
        <label className="block">
          <span className="text-xs font-black text-slate-600">{currentLabel}</span>
          <input
            name="balance"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={balanceValue}
            onChange={(event) => handleBalanceChange(event.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-black text-slate-600">{openingLabel}</span>
          <input
            name="opening_balance"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={openingValue}
            onChange={(event) => handleOpeningBalanceChange(event.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

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
