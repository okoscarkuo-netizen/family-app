'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AccountCard } from './AccountCard'
import { AccountModal } from './AccountModal'
import {
  inputClass,
  secondaryButtonClass,
} from '@/components/PageShell'
import type { FamilyAccount } from '@/lib/finance/types'
import {
  accountGroupOrder,
  getAccountGroup,
  isSharedAccount,
  normalizeOwner,
} from '@/lib/finance/types'

type Props = {
  accounts: FamilyAccount[]
}

type Owner = 'Oscar' | 'Livia'

const OWNERS: Owner[] = ['Oscar', 'Livia']
const panelClass =
  'rounded-[1.8rem] border border-[#ece4d8] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)]'
const emptyStateClass =
  'rounded-[1.4rem] border border-dashed border-[#e5ddd0] bg-[#fcfbf8] px-4 py-6 text-center text-sm font-black text-slate-500'

function normalizeSearchText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function matchesAccount(account: FamilyAccount, query: string): boolean {
  if (!query) return true

  const searchable = [
    account.name,
    account.type,
    account.owner,
    account.shared ? 'shared' : '',
    account.currency,
    account.kind === 'asset' ? '資產' : '負債',
    getAccountGroup(account),
  ]
    .map(normalizeSearchText)
    .join(' ')

  return searchable.includes(query)
}

function formatMoney(value: number) {
  return value.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ownerSurfaceClass(owner: Owner) {
  return owner === 'Oscar'
    ? 'from-[#ecfdf8] via-white to-[#fff8ec]'
    : 'from-[#fff4eb] via-white to-[#fff9f1]'
}

function ownerAccentClass(owner: Owner) {
  return owner === 'Oscar' ? 'text-[#15957d]' : 'text-[#d85d28]'
}

function ownerDotClass(owner: Owner) {
  return owner === 'Oscar' ? 'bg-[#17b79c]' : 'bg-[#f2b232]'
}

function ownerLabel(owner: Owner) {
  return owner
}

function buildGroupedItems(accounts: FamilyAccount[]) {
  return accountGroupOrder
    .map((group, index) => ({
      group,
      id: `account-group-${index}`,
      items: accounts.filter((account) => getAccountGroup(account) === group),
    }))
    .filter((group) => group.items.length > 0)
}

function getOwnerAccounts(accounts: FamilyAccount[], owner: Owner) {
  return accounts.filter((account) => isSharedAccount(account) || normalizeOwner(account.owner) === owner)
}

function OwnerSummaryCard({
  owner,
  accounts,
}: {
  owner: Owner
  accounts: FamilyAccount[]
}) {
  const assetTotal = accounts
    .filter((account) => account.kind === 'asset')
    .reduce((sum, account) => sum + account.balance, 0)
  const liabilityTotal = accounts
    .filter((account) => account.kind === 'liability')
    .reduce((sum, account) => sum + account.balance, 0)
  const net = assetTotal - liabilityTotal
  const sharedCount = accounts.filter((account) => isSharedAccount(account)).length
  const personalCount = accounts.length - sharedCount

  return (
    <div
      className={`overflow-hidden rounded-[2rem] bg-gradient-to-br px-5 pb-5 pt-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] ${ownerSurfaceClass(owner)}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-black tracking-[0.18em] text-slate-400">使用者</p>
          <div className="mt-1 text-[2rem] font-black tracking-[-0.04em] text-slate-950">
            {ownerLabel(owner)}
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">
            共用帳戶會同時顯示在 Oscar / Livia 兩邊
          </p>
        </div>
      </div>

      <div className="mt-7">
        <p className="text-[0.92rem] font-semibold tracking-[0.08em] text-slate-500">淨資產</p>
        <div className="mt-1 flex items-end gap-3">
          <div className={`text-[3rem] font-black leading-none tracking-[-0.05em] ${ownerAccentClass(owner)}`}>
            {net < 0 ? '-' : ''}{formatMoney(Math.abs(net))}
          </div>
          <div className={`pb-2 text-[1.4rem] ${ownerAccentClass(owner)}`}>◉</div>
        </div>
        <div className="mt-4 flex items-center gap-3 text-[0.95rem] font-semibold text-slate-600">
          <span>資產 {formatMoney(assetTotal)}</span>
          <span className="text-slate-300">|</span>
          <span>負債 {formatMoney(liabilityTotal)}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-[1.35rem] bg-white/88 px-3 py-3 shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
          <div className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">共用</div>
          <div className="mt-1 text-lg font-black text-slate-950">{sharedCount}</div>
        </div>
        <div className="rounded-[1.35rem] bg-white/88 px-3 py-3 shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
          <div className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">專屬</div>
          <div className="mt-1 text-lg font-black text-slate-950">{personalCount}</div>
        </div>
      </div>
    </div>
  )
}

function AccountGroupStack({
  title,
  count,
  accounts,
  emptyMessage,
  onEdit,
}: {
  title: string
  count: number
  accounts: FamilyAccount[]
  emptyMessage: string
  onEdit: (account: FamilyAccount) => void
}) {
  const groupedAccounts = buildGroupedItems(accounts)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        <span className="rounded-full border-2 border-slate-950 bg-[#25f4a3] px-2.5 py-1 text-xs font-black text-slate-950">
          {count}
        </span>
      </div>

      {groupedAccounts.length === 0 ? (
        <div className={emptyStateClass}>
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-5">
          {groupedAccounts.map(({ group, id, items }) => (
            <div key={group} id={id} className="scroll-mt-28">
              <h4 className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <span>{group}</span>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-black text-slate-500">
                  {items.length}
                </span>
              </h4>
              <div className="space-y-2">
                {items.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function OwnerTabs({
  activeOwner,
  visibleCounts,
  onChange,
}: {
  activeOwner: Owner
  visibleCounts: Record<Owner, number>
  onChange: (owner: Owner) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-[1.35rem] bg-[#f4f1ea] p-1">
      {OWNERS.map((owner) => {
        const isActive = owner === activeOwner

        return (
          <button
            key={owner}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(owner)}
            className={`rounded-[1.1rem] px-3 py-2 text-left transition ${
              isActive
                ? 'bg-white text-slate-950 shadow-[0_10px_20px_rgba(15,23,42,0.08)]'
                : 'bg-transparent text-slate-500'
            }`}
          >
            <span className="block text-base font-black">{owner}</span>
            <span className={`mt-0.5 block text-xs font-bold ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>
              {visibleCounts[owner]} 個帳戶
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function AccountList({ accounts }: Props) {
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingAccount, setEditingAccount] = useState<FamilyAccount | null>(null)
  const [query, setQuery] = useState('')
  const [activeOwner, setActiveOwner] = useState<Owner>('Oscar')
  const ownerCarouselRef = useRef<HTMLDivElement>(null)
  const ownerScrollTimeoutRef = useRef<number | null>(null)

  const normalizedQuery = normalizeSearchText(query)
  const visibleAccounts = useMemo(() => accounts.filter((account) => !account.hidden), [accounts])
  const visibleAccountsWithQuery = useMemo(
    () => visibleAccounts.filter((account) => matchesAccount(account, normalizedQuery)),
    [normalizedQuery, visibleAccounts],
  )
  const activeOwnerAccounts = useMemo(
    () => getOwnerAccounts(visibleAccounts, activeOwner),
    [activeOwner, visibleAccounts],
  )
  const activeOwnerFilteredAccounts = useMemo(
    () => getOwnerAccounts(visibleAccountsWithQuery, activeOwner),
    [activeOwner, visibleAccountsWithQuery],
  )
  const sharedAccounts = useMemo(
    () => activeOwnerFilteredAccounts.filter((account) => isSharedAccount(account)),
    [activeOwnerFilteredAccounts],
  )
  const personalAccounts = useMemo(
    () => activeOwnerFilteredAccounts.filter((account) => !isSharedAccount(account)),
    [activeOwnerFilteredAccounts],
  )
  const countsByOwner = useMemo<Record<Owner, number>>(
    () => ({
      Oscar: getOwnerAccounts(visibleAccountsWithQuery, 'Oscar').length,
      Livia: getOwnerAccounts(visibleAccountsWithQuery, 'Livia').length,
    }),
    [visibleAccountsWithQuery],
  )

  function openCreate() {
    setEditingAccount(null)
    setModalMode('create')
  }

  function openEdit(account: FamilyAccount) {
    setEditingAccount(account)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingAccount(null)
  }

  useEffect(() => {
    const container = ownerCarouselRef.current
    if (!container) return

    const targetIndex = OWNERS.indexOf(activeOwner)
    const targetWidth = container.clientWidth
    const targetScrollLeft = targetWidth * targetIndex

    if (Math.abs(container.scrollLeft - targetScrollLeft) < 4) return

    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' })
  }, [activeOwner])

  function handleOwnerScroll() {
    if (ownerScrollTimeoutRef.current != null) {
      window.clearTimeout(ownerScrollTimeoutRef.current)
    }

    ownerScrollTimeoutRef.current = window.setTimeout(() => {
      const container = ownerCarouselRef.current
      if (!container || container.clientWidth === 0) return

      const nextIndex = Math.min(
        OWNERS.length - 1,
        Math.max(0, Math.round(container.scrollLeft / container.clientWidth)),
      )
      const nextOwner = OWNERS[nextIndex]

      if (nextOwner && nextOwner !== activeOwner) {
        setActiveOwner(nextOwner)
      }
    }, 80)
  }

  function scrollToOwner(owner: Owner) {
    setActiveOwner(owner)
    const container = ownerCarouselRef.current
    if (!container) return

    const pageIndex = OWNERS.indexOf(owner)
    const targetLeft = container.clientWidth * pageIndex
    container.scrollTo({ left: targetLeft, behavior: 'smooth' })
  }

  const currentOwnerVisibleCount = activeOwnerAccounts.length
  const sharedCount = sharedAccounts.length
  const personalCount = personalAccounts.length

  return (
    <>
      <div className="mx-auto w-full max-w-md px-4 pb-32 pt-3">
        <section className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="px-4 pb-4 pt-[calc(0.9rem+env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/"
                aria-label="返回首頁"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-3xl font-black text-slate-950 transition hover:bg-slate-100"
              >
                ‹
              </Link>

              <h1 className="text-[1.9rem] font-black tracking-[-0.04em] text-slate-950">
                帳戶
              </h1>

              <div className="flex items-center gap-2">
                <Link
                  href="/more"
                  aria-label="更多"
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-[1.9rem] font-black text-slate-950 transition hover:bg-slate-100"
                >
                  ⋯
                </Link>
                <button
                  type="button"
                  onClick={openCreate}
                  aria-label="新增帳戶"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[2.1rem] font-light text-slate-950 transition hover:bg-slate-100"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-3">
              <OwnerTabs activeOwner={activeOwner} visibleCounts={countsByOwner} onChange={scrollToOwner} />
            </div>
          </div>

          <div
            ref={ownerCarouselRef}
            onScroll={handleOwnerScroll}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          >
            {OWNERS.map((owner) => {
              const ownerAccounts = getOwnerAccounts(visibleAccounts, owner)
              return (
                <div key={owner} className="w-full shrink-0 snap-center px-4 pb-4">
                  <OwnerSummaryCard owner={owner} accounts={ownerAccounts} />
                </div>
              )
            })}
          </div>

          <div className="pb-4">
            <div className="flex justify-center gap-2">
              {OWNERS.map((owner) => (
                <span
                  key={owner}
                  className={`h-2.5 w-2.5 rounded-full transition ${owner === activeOwner ? ownerDotClass(owner) : 'bg-slate-300'}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className={`${panelClass} mt-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">快速搜尋</p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {activeOwner} 的帳戶，包含共用帳戶
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border-2 border-slate-950 bg-[#e9fbff] px-2.5 py-1 text-xs font-black text-slate-700">
                {activeOwnerFilteredAccounts.length} / {currentOwnerVisibleCount}
              </span>
              {normalizedQuery ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className={secondaryButtonClass}
                >
                  清除
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="text-xs font-black text-slate-600">搜尋</span>
              <div className="relative mt-1">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜尋帳戶、類型、幣別或歸屬"
                  className={`${inputClass} pr-20`}
                  aria-label="搜尋帳戶"
                />
                {normalizedQuery ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border-2 border-slate-950 bg-[#fff45f] px-2 py-1 text-xs font-black text-slate-950 shadow-[2px_2px_0_#111827]"
                  >
                    清除
                  </button>
                ) : null}
              </div>
            </label>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-[1.1rem] border border-[#ece4d8] bg-[#fcfbf8] px-3 py-3">
                <div className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">共用</div>
                <div className="mt-1 text-base font-black text-slate-950">{sharedCount}</div>
              </div>
              <div className="rounded-[1.1rem] border border-[#ece4d8] bg-[#fcfbf8] px-3 py-3">
                <div className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">專屬</div>
                <div className="mt-1 text-base font-black text-slate-950">{personalCount}</div>
              </div>
              <div className="rounded-[1.1rem] border border-[#ece4d8] bg-[#fcfbf8] px-3 py-3">
                <div className="text-[0.68rem] font-black tracking-[0.16em] text-slate-400">顯示</div>
                <div className="mt-1 text-base font-black text-slate-950">{currentOwnerVisibleCount}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 space-y-4">
          {activeOwnerFilteredAccounts.length === 0 ? (
            <p className={emptyStateClass}>
              {normalizedQuery
                ? `找不到符合「${query}」的帳戶`
                : '還沒有帳戶，點右上角「＋ 新增帳戶」開始'}
            </p>
          ) : (
            <>
              {sharedAccounts.length > 0 ? (
                <AccountGroupStack
                  title="家庭共用"
                  count={sharedAccounts.length}
                  accounts={sharedAccounts}
                  emptyMessage="沒有共用帳戶"
                  onEdit={openEdit}
                />
              ) : null}

              {personalAccounts.length > 0 ? (
                <AccountGroupStack
                  title={`${activeOwner} 專屬`}
                  count={personalAccounts.length}
                  accounts={personalAccounts}
                  emptyMessage={`沒有 ${activeOwner} 專屬帳戶`}
                  onEdit={openEdit}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      {modalMode ? (
        <AccountModal
          mode={modalMode}
          account={editingAccount ?? undefined}
          onClose={closeModal}
        />
      ) : null}
    </>
  )
}
