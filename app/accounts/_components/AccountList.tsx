'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent, PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AccountCard } from './AccountCard'
import { AccountModal } from './AccountModal'
import type { FamilyAccount } from '@/lib/finance/types'
import {
  accountGroupOrder,
  getAccountGroup,
  isSharedAccount,
  normalizeOwner,
} from '@/lib/finance/types'
import { pinCashAccount, reorderAccounts } from '@/app/actions/accounts'

type Props = {
  accounts: FamilyAccount[]
  ledgerDeltas?: Record<string, number>
}

type Owner = 'Oscar' | 'Livia'

const OWNERS: Owner[] = ['Oscar', 'Livia']
const OWNER_SWIPE_MIN_DISTANCE = 56
const OWNER_SWIPE_MAX_VERTICAL_DRIFT = 48
const emptyStateClass =
  'rounded-[1.15rem] border border-dashed border-[#ddd4c5] bg-[#fcfbf8] px-4 py-7 text-center text-sm font-black text-slate-500'

function EyeIcon({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M3.5 12s3.5-6 8.5-6 8.5 6 8.5 6-3.5 6-8.5 6-8.5-6-8.5-6Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.9" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M3.5 12s3.5-6 8.5-6c2.1 0 3.9.7 5.3 1.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M20.5 12s-3.5 6-8.5 6c-2.1 0-3.9-.7-5.3-1.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="m4.5 19.5 15-15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="m7 14 5-5 5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="m12 3.8 2.67 5.41 5.98.87-4.33 4.22 1.02 5.96L12 17.47 6.66 20.26l1.02-5.96-4.33-4.22 5.98-.87L12 3.8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function matchesAccount(account: FamilyAccount, query: string): boolean {
  if (!query) return true

  const searchable = [
    account.name,
    account.type,
    account.owner,
    account.shared ? 'shared 共用 共同' : '',
    account.currency,
    account.kind === 'asset' ? '資產' : '負債',
    getAccountGroup(account),
    account.favorite ? '我的最愛 最愛 favorite' : '',
  ]
    .map(normalizeSearchText)
    .join(' ')

  return searchable.includes(query)
}

function ownerDisplayLabel(owner: Owner) {
  return owner === 'Oscar' ? '老公' : '老婆'
}

function ownerDisplayName(value: unknown) {
  const owner = normalizeOwner(value)
  if (owner === 'Oscar') return '老公'
  if (owner === 'Livia') return '老婆'
  return String(owner)
}

function ownerFromSwipe(owner: Owner, deltaX: number): Owner {
  const currentIndex = OWNERS.indexOf(owner)
  const nextIndex = deltaX < 0
    ? Math.min(OWNERS.length - 1, currentIndex + 1)
    : Math.max(0, currentIndex - 1)

  return OWNERS[nextIndex] ?? owner
}

function isFormControlTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, input, textarea, select, label'))
}

function buildGroupedItems(accounts: FamilyAccount[], idPrefix: string) {
  return accountGroupOrder
    .map((group, index) => ({
      group,
      id: `${idPrefix}-${index}`,
      items: accounts.filter((account) => getAccountGroup(account) === group),
    }))
    .filter((group) => group.items.length > 0)
}

function buildFavoriteItems(accounts: FamilyAccount[]) {
  return accounts.filter((account) => account.favorite)
}

function getOwnerAccounts(accounts: FamilyAccount[], owner: Owner) {
  return accounts.filter((account) => isSharedAccount(account) || normalizeOwner(account.owner) === owner)
}

function OwnerTopTabs({
  activeOwner,
  visibleCounts,
  onChange,
}: {
  activeOwner: Owner
  visibleCounts: Record<Owner, number>
  onChange: (owner: Owner) => void
}) {
  return (
    <div className="grid grid-cols-2 border-b border-[#e3dbce] px-1">
      {OWNERS.map((owner) => {
        const isActive = owner === activeOwner

        return (
          <button
            key={owner}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(owner)}
            className={`relative py-2 text-center transition ${isActive ? 'text-slate-950' : 'text-slate-400'}`}
          >
            <span className="block text-[0.95rem] font-black">{ownerDisplayLabel(owner)}</span>
            <span className="mt-0.5 block text-[0.68rem] font-bold">{visibleCounts[owner]} 個帳戶</span>
            {isActive ? <span className="absolute inset-x-8 -bottom-px h-0.5 rounded-full bg-[#f2b232]" /> : null}
          </button>
        )
      })}
    </div>
  )
}

function AccountOverviewPanel({
  accounts,
  hiddenAccounts,
  hiddenCount,
  query,
  onQueryChange,
  showHiddenAccounts,
  currentOwnerHiddenCount,
  onToggleHidden,
  onToggleToolsMenu,
  onOpenSort,
  onOpenCreate,
  isToolsMenuOpen,
}: {
  accounts: FamilyAccount[]
  hiddenAccounts: FamilyAccount[]
  hiddenCount: number
  query: string
  onQueryChange: (value: string) => void
  showHiddenAccounts: boolean
  currentOwnerHiddenCount: number
  onToggleHidden: () => void
  onToggleToolsMenu: () => void
  onOpenSort: () => void
  onOpenCreate: () => void
  isToolsMenuOpen: boolean
}) {
  const sharedCount = accounts.filter((account) => isSharedAccount(account)).length
  const personalCount = accounts.length - sharedCount
  const hiddenTwdBalance = hiddenAccounts
    .filter((a) => a.currency === 'TWD')
    .reduce((sum, a) => sum + (a.balance ?? 0), 0)
  const hiddenBalanceStr = hiddenTwdBalance.toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const hiddenBalanceFontClass =
    hiddenBalanceStr.length > 10
      ? 'text-[0.55rem]'
      : hiddenBalanceStr.length > 7
        ? 'text-[0.65rem]'
        : 'text-xs'

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[#ece4d8] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={onToggleToolsMenu}
          aria-expanded={isToolsMenuOpen}
          aria-controls="account-tools-menu"
          aria-label={`${isToolsMenuOpen ? '關閉' : '開啟'}帳戶工具選單`}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-slate-700 shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition ${
            isToolsMenuOpen
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-[#e7ddd0] bg-[#faf7f1] hover:border-[#d8c7b0] hover:bg-[#f6f0e6] hover:text-slate-950'
          }`}
        >
          <MenuIcon />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">帳戶概況</p>
          <p className="mt-0.5 truncate text-[0.95rem] font-black text-slate-950">
            {accounts.length} 個可見帳戶
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreate}
          aria-label="新增帳戶"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
        >
          <PlusIcon />
        </button>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="grid grid-cols-3 gap-2">
          {([['共用', sharedCount], ['個人', personalCount]] as [string, number][]).map(([label, count]) => (
            <div key={label} className="rounded-[0.95rem] bg-[#fbfaf7] px-3 py-2.5 ring-1 ring-[#f0e7da]">
              <div className="text-[0.68rem] font-black tracking-[0.14em] text-slate-400">{label}</div>
              <div className="mt-1 flex min-w-0 items-baseline gap-2">
                <span className="text-base font-black text-slate-950">{count}</span>
              </div>
            </div>
          ))}
          <div className="rounded-[0.95rem] bg-[#fbfaf7] px-3 py-2.5 ring-1 ring-[#f0e7da]">
            <div className="text-[0.68rem] font-black tracking-[0.14em] text-slate-400">隱藏</div>
            <div className="mt-1 flex min-w-0 items-baseline gap-1">
              <span className="text-base font-black text-slate-950">{hiddenCount}</span>
              {hiddenCount > 0 && (
                <span className={`min-w-0 truncate font-black leading-none text-slate-400 ${hiddenBalanceFontClass}`}>
                  {hiddenTwdBalance < 0 ? '-' : '+'}{Math.abs(hiddenTwdBalance).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  <span className="ml-0.5 text-[0.55rem]">TWD</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {isToolsMenuOpen ? (
          <div id="account-tools-menu" className="mt-3">
            <AccountToolsMenu
              query={query}
              onQueryChange={onQueryChange}
              showHiddenAccounts={showHiddenAccounts}
              currentOwnerHiddenCount={currentOwnerHiddenCount}
              onToggleHidden={onToggleHidden}
              onOpenSort={onOpenSort}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AccountToolsMenu({
  query,
  onQueryChange,
  showHiddenAccounts,
  currentOwnerHiddenCount,
  onToggleHidden,
  onOpenSort,
}: {
  query: string
  onQueryChange: (value: string) => void
  showHiddenAccounts: boolean
  currentOwnerHiddenCount: number
  onToggleHidden: () => void
  onOpenSort: () => void
}) {
  const normalizedQuery = normalizeSearchText(query)

  return (
    <div className="space-y-3 rounded-[1rem] bg-[#fbfaf7] p-3">
      <label className="relative block">
        <span className="sr-only">搜尋帳戶</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜尋帳戶、類型、幣別"
          className="ios-search-input h-11 w-full rounded-full border border-[#e8dfd1] bg-white px-4 pr-10 font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#f2b232]/20"
          aria-label="搜尋帳戶"
        />
        {normalizedQuery ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-lg font-black text-slate-400 transition hover:bg-[#f6f2eb] hover:text-slate-950"
            aria-label="清除搜尋"
          >
            ×
          </button>
        ) : null}
      </label>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={onToggleHidden}
          className={`inline-flex h-11 items-center justify-between gap-3 rounded-full border px-4 text-sm font-black transition ${
            showHiddenAccounts
              ? 'border-slate-950 bg-slate-950 text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]'
              : 'border-[#e7ddd0] bg-white text-slate-700 hover:border-[#d8c7b0] hover:bg-[#f6f0e6]'
          }`}
          aria-pressed={showHiddenAccounts}
        >
          <span className="flex items-center gap-2">
            <EyeIcon isOpen={!showHiddenAccounts} />
            <span>{showHiddenAccounts ? '收起隱藏帳戶' : '查看隱藏帳戶'}</span>
          </span>
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-[0.7rem] font-black">
            {currentOwnerHiddenCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSort}
          className="inline-flex h-11 items-center justify-between gap-3 rounded-full border border-[#e7ddd0] bg-white px-4 text-sm font-black text-slate-700 transition hover:border-[#d8c7b0] hover:bg-[#f6f0e6] hover:text-slate-950"
        >
          <span className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#f6f2eb] text-slate-700">
              <MenuIcon />
            </span>
            <span>編輯帳戶排序</span>
          </span>
          <span className="text-slate-300">›</span>
        </button>
      </div>

    </div>
  )
}

function FavoriteAccountSection({
  accounts,
  ledgerDeltas,
  onPinCash,
  pinDisabled,
}: {
  accounts: FamilyAccount[]
  ledgerDeltas?: Record<string, number>
  onPinCash: (account: FamilyAccount) => void
  pinDisabled: boolean
}) {
  if (accounts.length === 0) return null

  return (
    <section className="overflow-hidden rounded-[1.2rem] border border-[#efd79e] bg-[linear-gradient(180deg,#fff9e7_0%,#fffdf6_100%)] shadow-[0_14px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-3 bg-[#fff5d7] px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#f0c86f] bg-white text-[#9b6b06] shadow-[0_4px_10px_rgba(15,23,42,0.04)]">
          <StarIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.95rem] font-black text-[#8a5d08]">我的最愛</h3>
          <p className="mt-0.5 text-[0.68rem] font-bold text-[#b08928]">{accounts.length} 個帳戶會固定置頂</p>
        </div>
      </div>

      <div className="divide-y divide-[#f1e1b6]">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            ledgerDelta={ledgerDeltas?.[account.id]}
            onPinCash={onPinCash}
            pinDisabled={pinDisabled}
          />
        ))}
      </div>
    </section>
  )
}

function AccountSortModal({
  accounts,
  onClose,
  onSave,
}: {
  accounts: FamilyAccount[]
  onClose: () => void
  onSave: (orderedAccountIds: string[]) => Promise<void>
}) {
  const [draftAccounts, setDraftAccounts] = useState(accounts)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function moveAccount(index: number, direction: number) {
    setDraftAccounts((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current

      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await onSave(draftAccounts.map((account) => account.id))
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '帳戶排序更新失敗，請再試一次')
      }
    })
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border border-[#ece4d8] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-sort-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="account-sort-title" className="text-lg font-black text-slate-950">編輯帳戶排序</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              由上到下就是實際顯示順序，設為我的最愛的帳戶會固定置頂。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full border border-[#e7ddd0] bg-[#faf7f1] text-slate-500 transition hover:border-[#d8c7b0] hover:bg-white hover:text-slate-950"
            aria-label="關閉排序面板"
          >
            ×
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-[0.85rem] bg-[#fff1f1] px-3 py-2 text-xs font-black text-[#c9563f]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {draftAccounts.map((account, index) => {
            const isShared = isSharedAccount(account)

            return (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-[1rem] border border-[#ece4d8] bg-[#fbfaf7] px-3 py-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[0.72rem] font-black text-slate-500">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-slate-950">{account.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.68rem] font-bold text-slate-400">
                    <span>{account.type}</span>
                    <span>·</span>
                    <span>{ownerDisplayName(account.owner)}</span>
                    {account.favorite ? (
                      <span className="rounded-full bg-[#fff5d8] px-2 py-0.5 text-[#9b6b06]">我的最愛</span>
                    ) : null}
                    {account.hidden ? (
                      <span className="rounded-full bg-[#fff1f1] px-2 py-0.5 text-[#d85d28]">隱藏</span>
                    ) : null}
                    {isShared ? (
                      <span className="rounded-full bg-[#ecfdf8] px-2 py-0.5 text-[#15957d]">共用</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveAccount(index, -1)}
                    disabled={index === 0 || isPending}
                    className="flex size-9 items-center justify-center rounded-full border border-[#e7ddd0] bg-white text-slate-600 transition hover:border-[#d8c7b0] hover:bg-[#f6f0e6] disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`將 ${account.name} 往上移`}
                  >
                    <ChevronUpIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAccount(index, 1)}
                    disabled={index === draftAccounts.length - 1 || isPending}
                    className="flex size-9 items-center justify-center rounded-full border border-[#e7ddd0] bg-white text-slate-600 transition hover:border-[#d8c7b0] hover:bg-[#f6f0e6] disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`將 ${account.name} 往下移`}
                  >
                    <ChevronDownIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e7ddd0] bg-[#faf7f1] px-4 py-2 text-sm font-black text-slate-700 transition hover:border-[#d8c7b0] hover:bg-white hover:text-slate-950"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? '儲存中…' : '儲存排序'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function AccountGroupSections({
  accounts,
  ledgerDeltas,
  emptyMessage,
  idPrefix,
  onPinCash,
  pinDisabled,
}: {
  accounts: FamilyAccount[]
  ledgerDeltas?: Record<string, number>
  emptyMessage: string
  idPrefix: string
  onPinCash: (account: FamilyAccount) => void
  pinDisabled: boolean
}) {
  const groupedAccounts = buildGroupedItems(accounts, idPrefix)

  if (groupedAccounts.length === 0) {
    return <p className={emptyStateClass}>{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {groupedAccounts.map(({ group, id, items }) => (
        <section
          key={group}
          id={id}
          className="scroll-mt-32 overflow-hidden rounded-[1.2rem] border border-[#ece4d8] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start justify-between gap-3 bg-[#fbfaf7] px-4 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-[0.95rem] font-black text-slate-950">{group}</h3>
              <p className="mt-0.5 text-[0.68rem] font-bold text-slate-400">{items.length} 個帳戶</p>
            </div>
          </div>

          <div className="divide-y divide-[#efebe4]">
            {items.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                ledgerDelta={ledgerDeltas?.[account.id]}
                onPinCash={onPinCash}
                pinDisabled={pinDisabled}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function AccountList({ accounts, ledgerDeltas }: Props) {
  const router = useRouter()
  const ownerSwipeStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const suppressOwnerSwipeClickRef = useRef(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeOwner, setActiveOwner] = useState<Owner>('Oscar')
  const [showHiddenAccounts, setShowHiddenAccounts] = useState(false)
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
  const [isSortModalOpen, setIsSortModalOpen] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [isPinPending, startPinTransition] = useTransition()

  const normalizedQuery = normalizeSearchText(query)
  const visibleAccounts = useMemo(() => accounts.filter((account) => !account.hidden), [accounts])
  const hiddenAccounts = useMemo(() => accounts.filter((account) => account.hidden), [accounts])
  const activeOwnerAccounts = useMemo(
    () => getOwnerAccounts(accounts, activeOwner),
    [accounts, activeOwner],
  )
  const activeOwnerVisibleAccounts = useMemo(
    () => activeOwnerAccounts.filter((account) => !account.hidden),
    [activeOwnerAccounts],
  )
  const activeOwnerMatchedAccounts = useMemo(
    () => activeOwnerAccounts.filter((account) => matchesAccount(account, normalizedQuery)),
    [activeOwnerAccounts, normalizedQuery],
  )
  const activeOwnerVisibleMatchedAccounts = useMemo(
    () => activeOwnerMatchedAccounts.filter((account) => !account.hidden),
    [activeOwnerMatchedAccounts],
  )
  const displayedAccounts = useMemo(
    () => (showHiddenAccounts ? activeOwnerMatchedAccounts : activeOwnerVisibleMatchedAccounts),
    [activeOwnerMatchedAccounts, activeOwnerVisibleMatchedAccounts, showHiddenAccounts],
  )
  const favoriteAccounts = useMemo(
    () => buildFavoriteItems(displayedAccounts),
    [displayedAccounts],
  )
  const regularAccounts = useMemo(
    () => displayedAccounts.filter((account) => !account.favorite),
    [displayedAccounts],
  )
  const countsByOwner = useMemo<Record<Owner, number>>(
    () => ({
      Oscar: getOwnerAccounts(visibleAccounts, 'Oscar').length,
      Livia: getOwnerAccounts(visibleAccounts, 'Livia').length,
    }),
    [visibleAccounts],
  )
  const currentOwnerHiddenCount = useMemo(
    () => getOwnerAccounts(hiddenAccounts, activeOwner).length,
    [activeOwner, hiddenAccounts],
  )
  const currentOwnerTotalCount = useMemo(
    () => activeOwnerAccounts.length,
    [activeOwnerAccounts],
  )

  function openCreate() {
    setIsToolsMenuOpen(false)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  function openSortModal() {
    setIsToolsMenuOpen(false)
    setIsSortModalOpen(true)
  }

  function closeSortModal() {
    setIsSortModalOpen(false)
  }

  function handleOwnerSwipePointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressOwnerSwipeClickRef.current = false
    ownerSwipeStartRef.current = null
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    if (isFormControlTarget(event.target)) return

    ownerSwipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
  }

  function handleOwnerSwipePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = ownerSwipeStartRef.current
    ownerSwipeStartRef.current = null
    if (!start || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    if (absX < OWNER_SWIPE_MIN_DISTANCE) return
    if (absY > OWNER_SWIPE_MAX_VERTICAL_DRIFT) return
    if (absX < absY * 1.35) return

    const nextOwner = ownerFromSwipe(activeOwner, deltaX)
    if (nextOwner === activeOwner) return

    suppressOwnerSwipeClickRef.current = true
    setActiveOwner(nextOwner)
  }

  function handleOwnerSwipeClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressOwnerSwipeClickRef.current) return

    suppressOwnerSwipeClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function handlePinCash(account: FamilyAccount) {
    setPinError(null)
    startPinTransition(async () => {
      try {
        await pinCashAccount(account.id)
        router.refresh()
      } catch (err) {
        setPinError(err instanceof Error ? err.message : '現金帳戶置頂失敗，請再試一次')
      }
    })
  }

  async function handleReorderAccounts(orderedAccountIds: string[]) {
    await reorderAccounts(orderedAccountIds)
    router.refresh()
  }

  const currentOwnerVisibleCount = activeOwnerVisibleAccounts.length

  return (
    <>
      <div
        className="mx-auto w-full max-w-md px-4 pb-32 pt-[calc(0.25rem+env(safe-area-inset-top))]"
        onClickCapture={handleOwnerSwipeClickCapture}
        onPointerCancel={() => {
          ownerSwipeStartRef.current = null
        }}
        onPointerDown={handleOwnerSwipePointerDown}
        onPointerUp={handleOwnerSwipePointerUp}
        style={{ touchAction: 'pan-y' }}
      >
        <OwnerTopTabs
          activeOwner={activeOwner}
          visibleCounts={countsByOwner}
          onChange={(owner) => {
            setIsToolsMenuOpen(false)
            setActiveOwner(owner)
          }}
        />

        <div className="mt-3">
          <AccountOverviewPanel
            accounts={visibleAccounts}
            hiddenAccounts={hiddenAccounts}
            hiddenCount={hiddenAccounts.length}
            query={query}
            onQueryChange={setQuery}
            showHiddenAccounts={showHiddenAccounts}
            currentOwnerHiddenCount={currentOwnerHiddenCount}
            onToggleHidden={() => setShowHiddenAccounts((value) => !value)}
            onToggleToolsMenu={() => setIsToolsMenuOpen((value) => !value)}
            onOpenSort={openSortModal}
            onOpenCreate={openCreate}
            isToolsMenuOpen={isToolsMenuOpen}
          />
        </div>

        {pinError ? (
          <p className="mt-2 rounded-[0.85rem] bg-[#fff1f1] px-3 py-2 text-xs font-black text-[#c9563f]">
            {pinError}
          </p>
        ) : null}

        <p className="mt-2 px-1 text-[0.72rem] font-bold text-slate-400">
          {normalizedQuery
            ? `顯示 ${displayedAccounts.length} / ${showHiddenAccounts ? currentOwnerTotalCount : currentOwnerVisibleCount} 個符合條件的帳戶`
            : showHiddenAccounts
              ? `${ownerDisplayLabel(activeOwner)} ${displayedAccounts.length} 個帳戶（含 ${currentOwnerHiddenCount} 個隱藏）`
              : `${ownerDisplayLabel(activeOwner)} ${currentOwnerVisibleCount} 個可見帳戶`}
        </p>

        <div className="mt-4 space-y-3">
          <FavoriteAccountSection
            accounts={favoriteAccounts}
            ledgerDeltas={ledgerDeltas}
            onPinCash={handlePinCash}
            pinDisabled={isPinPending}
          />

          {regularAccounts.length > 0 ? (
            <AccountGroupSections
              accounts={regularAccounts}
              ledgerDeltas={ledgerDeltas}
              emptyMessage=""
              idPrefix="account-group"
              onPinCash={handlePinCash}
              pinDisabled={isPinPending}
            />
          ) : null}

          {displayedAccounts.length === 0 ? (
            <p className={emptyStateClass}>
              {normalizedQuery
                ? `找不到符合「${query}」的帳戶`
                : currentOwnerHiddenCount > 0
                  ? '目前沒有可見帳戶，請點上方眼睛按鈕查看隱藏帳戶'
                  : '還沒有帳戶，點左上角加號開始'}
            </p>
          ) : null}
        </div>

      </div>

      {modalOpen ? (
        <AccountModal
          mode="create"
          onClose={closeModal}
        />
      ) : null}

      {isSortModalOpen ? (
        <AccountSortModal
          accounts={activeOwnerAccounts}
          onClose={closeSortModal}
          onSave={handleReorderAccounts}
        />
      ) : null}
    </>
  )
}
