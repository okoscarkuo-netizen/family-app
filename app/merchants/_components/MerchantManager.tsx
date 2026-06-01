'use client'

import { useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyMerchant, FamilyMerchantGroup } from '@/lib/family-transactions'
import {
  archiveMerchantGroup,
  createMerchant,
  createMerchantGroup,
  renameMerchantGroup,
  updateMerchant,
  updateMerchantGroup,
} from '@/app/actions/merchant-groups'

type Props = {
  initialMerchants: FamilyMerchant[]
  initialGroups: FamilyMerchantGroup[]
}

type MerchantView = 'merchants' | 'groups'

const MERCHANT_VIEWS: Array<{ id: MerchantView; label: string }> = [
  { id: 'merchants', label: '商家' },
  { id: 'groups', label: '分類' },
]

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase('zh-TW')
}

function handleLastUsedValue(merchant: FamilyMerchant) {
  return merchant.last_used_at ? merchant.last_used_at.slice(0, 10) : ''
}

type GroupOptimisticAction =
  | { type: 'add'; group: FamilyMerchantGroup }
  | { type: 'update'; group: FamilyMerchantGroup }
  | { type: 'archive'; id: string }

type MerchantOptimisticAction =
  | { type: 'add'; merchant: FamilyMerchant }
  | { type: 'update'; merchant: FamilyMerchant }
  | { type: 'unassignFromGroup'; groupId: string }

export function MerchantManager({ initialMerchants, initialGroups }: Props) {
  const router = useRouter()
  const merchantNameInputRef = useRef<HTMLInputElement>(null)
  const [merchants, setMerchants] = useState(initialMerchants)
  const [groups, setGroups] = useState(initialGroups)
  const [, startTransition] = useTransition()
  const [optimisticGroups, applyOptimisticGroups] = useOptimistic(
    groups,
    (current: FamilyMerchantGroup[], action: GroupOptimisticAction): FamilyMerchantGroup[] => {
      switch (action.type) {
        case 'add':
          return [...current, action.group]
        case 'update':
          return current.map((item) => (item.id === action.group.id ? action.group : item))
        case 'archive':
          return current.filter((item) => item.id !== action.id)
      }
    },
  )
  const [optimisticMerchants, applyOptimisticMerchants] = useOptimistic(
    merchants,
    (current: FamilyMerchant[], action: MerchantOptimisticAction): FamilyMerchant[] => {
      switch (action.type) {
        case 'add':
          return [...current, action.merchant]
        case 'update':
          return current.map((item) => (item.id === action.merchant.id ? action.merchant : item))
        case 'unassignFromGroup':
          return current.map((item) => (item.group_id === action.groupId ? { ...item, group_id: null } : item))
      }
    },
  )
  const [view, setView] = useState<MerchantView>('merchants')
  const [query, setQuery] = useState('')
  const [newMerchantName, setNewMerchantName] = useState('')
  const [newMerchantGroupId, setNewMerchantGroupId] = useState(() => initialGroups[0]?.id ?? '')
  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null)
  const [editingMerchantName, setEditingMerchantName] = useState('')
  const pendingKey: string | null = null
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const normalizedQuery = normalizeSearchText(query)
  const groupOptions = [
    { value: '', label: '未分類' },
    ...optimisticGroups.map((group) => ({ value: group.id, label: group.name })),
  ]

  const merchantCountByGroupId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const merchant of optimisticMerchants) {
      if (!merchant.group_id) continue
      counts.set(merchant.group_id, (counts.get(merchant.group_id) ?? 0) + 1)
    }
    return counts
  }, [optimisticMerchants])

  const groupedMerchants = useMemo(() => {
    const grouped = new Map<string, FamilyMerchant[]>()
    const unassigned: FamilyMerchant[] = []

    const sortedMerchants = [...optimisticMerchants].sort((a, b) => {
      if (a.last_used_at !== b.last_used_at) {
        return b.last_used_at.localeCompare(a.last_used_at)
      }

      return a.name.localeCompare(b.name, 'zh-TW')
    })

    for (const merchant of sortedMerchants) {
      if (!merchant.group_id) {
        unassigned.push(merchant)
        continue
      }

      const existing = grouped.get(merchant.group_id) ?? []
      existing.push(merchant)
      grouped.set(merchant.group_id, existing)
    }

    return { grouped, unassigned }
  }, [optimisticMerchants])

  const recentMerchants = useMemo(() => {
    return [...optimisticMerchants]
      .sort((a, b) => {
        if (a.last_used_at !== b.last_used_at) {
          return b.last_used_at.localeCompare(a.last_used_at)
        }

        return a.name.localeCompare(b.name, 'zh-TW')
      })
      .slice(0, 5)
  }, [optimisticMerchants])

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return optimisticGroups

    return optimisticGroups.filter((group) => {
      const groupMatches = group.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery)
      const merchantMatches = (groupedMerchants.grouped.get(group.id) ?? []).some((merchant) =>
        merchant.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
      )
      return groupMatches || merchantMatches
    })
  }, [optimisticGroups, groupedMerchants.grouped, normalizedQuery])

  const filteredUnassignedMerchants = useMemo(() => {
    if (!normalizedQuery) return groupedMerchants.unassigned

    return groupedMerchants.unassigned.filter((merchant) =>
      merchant.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
    )
  }, [groupedMerchants.unassigned, normalizedQuery])

  const unassignedMerchantCount = groupedMerchants.unassigned.length

  function handleEnter(event: KeyboardEvent<HTMLInputElement>, action: () => void) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    action()
  }

  function refreshLocalData() {
    router.refresh()
  }

  function upsertGroup(group: FamilyMerchantGroup) {
    setGroups((current) => {
      const existingIndex = current.findIndex((item) => item.id === group.id)
      if (existingIndex === -1) return [...current, group]
      return current.map((item) => (item.id === group.id ? group : item))
    })
    refreshLocalData()
  }

  function archiveGroupLocal(groupId: string) {
    setGroups((current) => current.filter((group) => group.id !== groupId))
    setMerchants((current) =>
      current.map((merchant) =>
        merchant.group_id === groupId ? { ...merchant, group_id: null } : merchant,
      ),
    )
    if (newMerchantGroupId === groupId) {
      setNewMerchantGroupId('')
    }
    refreshLocalData()
  }

  function upsertMerchant(merchant: FamilyMerchant) {
    setMerchants((current) => {
      const existingIndex = current.findIndex((item) => item.id === merchant.id)
      if (existingIndex === -1) return [...current, merchant]
      return current.map((item) => (item.id === merchant.id ? merchant : item))
    })
    refreshLocalData()
  }

  function startEditingGroup(group: FamilyMerchantGroup) {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
    setEditingMerchantId(null)
    setEditingMerchantName('')
    setNotice(null)
  }

  function startEditingMerchant(merchant: FamilyMerchant) {
    setEditingMerchantId(merchant.id)
    setEditingMerchantName(merchant.name)
    setEditingGroupId(null)
    setEditingGroupName('')
    setNotice(null)
  }

  function focusMerchantComposer(groupId?: string) {
    if (typeof groupId === 'string') {
      setNewMerchantGroupId(groupId)
    }

    requestAnimationFrame(() => {
      merchantNameInputRef.current?.focus()
    })
  }

  function handleCreateGroup() {
    const normalizedName = newGroupName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家分類名稱不能空白。' })
      return
    }

    const nowIso = new Date().toISOString()
    const tempGroup: FamilyMerchantGroup = {
      id: `temp-${crypto.randomUUID()}`,
      name: normalizedName,
      sort_order: Number.MAX_SAFE_INTEGER,
      is_archived: false,
      created_at: nowIso,
      updated_at: nowIso,
    }
    setNewGroupName('')
    setNotice(null)

    startTransition(async () => {
      applyOptimisticGroups({ type: 'add', group: tempGroup })
      const result = await createMerchantGroup(normalizedName)
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      upsertGroup(result.group)
      setNewMerchantGroupId(result.group.id)
    })
  }

  function handleRenameGroup() {
    if (!editingGroupId) return

    const normalizedName = editingGroupName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家分類名稱不能空白。' })
      return
    }

    const target = groups.find((item) => item.id === editingGroupId)
    if (!target) return

    const optimisticUpdated: FamilyMerchantGroup = { ...target, name: normalizedName }
    const updateId = editingGroupId
    setEditingGroupId(null)
    setEditingGroupName('')
    setNotice(null)

    startTransition(async () => {
      applyOptimisticGroups({ type: 'update', group: optimisticUpdated })
      const result = await renameMerchantGroup({ id: updateId, name: normalizedName })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      upsertGroup(result.group)
    })
  }

  function handleArchiveGroup(group: FamilyMerchantGroup) {
    if (!window.confirm(`封存「${group.name}」？分類裡的商家會回到未分類。`)) return

    const archivedGroupId = group.id
    setNotice(null)

    startTransition(async () => {
      applyOptimisticGroups({ type: 'archive', id: archivedGroupId })
      applyOptimisticMerchants({ type: 'unassignFromGroup', groupId: archivedGroupId })
      const result = await archiveMerchantGroup(archivedGroupId)
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      archiveGroupLocal(archivedGroupId)
    })
  }

  function handleCreateMerchant() {
    const normalizedName = newMerchantName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家名稱不能空白。' })
      return
    }

    const targetGroupId = newMerchantGroupId || null
    const nowIso = new Date().toISOString()
    const tempMerchant: FamilyMerchant = {
      id: `temp-${crypto.randomUUID()}`,
      name: normalizedName,
      group_id: targetGroupId,
      last_used_at: nowIso,
      is_archived: false,
      created_at: nowIso,
    }
    setNewMerchantName('')
    setNotice(null)

    startTransition(async () => {
      applyOptimisticMerchants({ type: 'add', merchant: tempMerchant })
      const result = await createMerchant({
        name: normalizedName,
        groupId: targetGroupId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      upsertMerchant(result.merchant)
    })
  }

  function handleMerchantRename() {
    if (!editingMerchantId) return

    const normalizedName = editingMerchantName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '商家名稱不能空白。' })
      return
    }

    const target = merchants.find((item) => item.id === editingMerchantId) ?? null
    if (!target) return

    const optimisticUpdated: FamilyMerchant = { ...target, name: normalizedName }
    const updateId = editingMerchantId
    setEditingMerchantId(null)
    setEditingMerchantName('')
    setNotice(null)

    startTransition(async () => {
      applyOptimisticMerchants({ type: 'update', merchant: optimisticUpdated })
      const result = await updateMerchant({
        merchantId: updateId,
        name: normalizedName,
        groupId: target.group_id,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      upsertMerchant(result.merchant)
    })
  }

  function handleMerchantGroupChange(merchantId: string, nextGroupId: string) {
    const target = merchants.find((item) => item.id === merchantId)
    if (!target) return

    const resolvedGroupId = nextGroupId === '__unassigned__' ? null : nextGroupId
    const optimisticUpdated: FamilyMerchant = { ...target, group_id: resolvedGroupId }
    setNotice(null)

    startTransition(async () => {
      applyOptimisticMerchants({ type: 'update', merchant: optimisticUpdated })
      const result = await updateMerchantGroup({
        merchantId,
        groupId: resolvedGroupId,
      })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      upsertMerchant(result.merchant)
    })
  }

  function renderMerchantRow(merchant: FamilyMerchant) {
    const isEditing = editingMerchantId === merchant.id
    const pendingMerchantKey = pendingKey === `rename-merchant-${merchant.id}`
    const merchantGroupName = merchant.group_id
      ? groups.find((group) => group.id === merchant.group_id)?.name ?? '未分類'
      : '未分類'

    return (
      <div
        key={merchant.id}
        className="rounded-[1.15rem] border border-[#eee6d9] bg-[#fcfbf8] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editingMerchantName}
                onChange={(event) => setEditingMerchantName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setEditingMerchantId(null)
                    setEditingMerchantName('')
                    return
                  }
                  handleEnter(event, handleMerchantRename)
                }}
                className="w-full rounded-[1rem] border border-[#eadfce] bg-white px-3 py-2 text-sm font-black text-slate-950 outline-none"
                aria-label="商家名稱"
                autoFocus
              />
            ) : (
              <div className="truncate text-[0.98rem] font-black text-slate-900">{merchant.name}</div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#f4f1ea] px-2.5 py-1 text-[0.68rem] font-black text-slate-600">
                {merchantGroupName}
              </span>
              {merchant.last_used_at ? (
                <span className="text-xs font-bold text-slate-400">
                  最近使用 {handleLastUsedValue(merchant)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <select
            value={merchant.group_id ?? '__unassigned__'}
            onChange={(event) => handleMerchantGroupChange(merchant.id, event.target.value)}
            disabled={pendingKey === `merchant-${merchant.id}` || Boolean(pendingKey)}
            className="min-w-0 rounded-[0.95rem] border border-[#e7dccb] bg-white px-3 py-2.5 text-sm font-black text-slate-700 outline-none disabled:opacity-50"
            aria-label={`設定 ${merchant.name} 的商家分類`}
          >
            {groupOptions.map((option) => (
              <option key={option.value || '__empty'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {isEditing ? (
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
              onClick={() => startEditingMerchant(merchant)}
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

  function renderGroupRow(group: FamilyMerchantGroup) {
    const isEditing = editingGroupId === group.id
    const isPending = pendingKey === `rename-group-${group.id}` || pendingKey === `archive-group-${group.id}`
    const totalMerchantCount = merchantCountByGroupId.get(group.id) ?? 0
    const merchantsInGroup = groupedMerchants.grouped.get(group.id) ?? []
    const groupMatches = normalizedQuery
      ? group.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery)
      : false
    const visibleMerchants = !normalizedQuery || groupMatches
      ? merchantsInGroup
      : merchantsInGroup.filter((merchant) =>
          merchant.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
        )

    return (
      <section
        key={group.id}
        className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f2ece2] px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-900">
              {isEditing ? (
                <input
                  type="text"
                  value={editingGroupName}
                  onChange={(event) => setEditingGroupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setEditingGroupId(null)
                      setEditingGroupName('')
                      return
                    }
                    handleEnter(event, handleRenameGroup)
                  }}
                  className="w-full rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-2 text-sm font-black text-slate-950 outline-none"
                  aria-label="商家分類名稱"
                  autoFocus
                />
              ) : (
                group.name
              )}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-slate-400">
              {visibleMerchants.length} / {totalMerchantCount} 個商家
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => focusMerchantComposer(group.id)}
              disabled={Boolean(pendingKey)}
              className="rounded-full bg-[#ecfdf8] px-3 py-2 text-xs font-black text-[#187d5f] disabled:opacity-50"
            >
              新增到此分類
            </button>

            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleRenameGroup}
                  disabled={isPending}
                  className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  儲存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroupId(null)
                    setEditingGroupName('')
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
                  onClick={() => startEditingGroup(group)}
                  disabled={Boolean(pendingKey)}
                  className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
                >
                  修改
                </button>
                <button
                  type="button"
                  onClick={() => handleArchiveGroup(group)}
                  disabled={Boolean(pendingKey)}
                  className="rounded-full bg-[#fff3f2] px-3 py-2 text-xs font-black text-[#c2413a] disabled:opacity-50"
                >
                  封存
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2 px-3 py-3">
          {visibleMerchants.length > 0 ? (
            visibleMerchants.map((merchant) => renderMerchantRow(merchant))
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-[#e3d9c6] bg-[#fcfbf8] px-4 py-8 text-center text-sm font-bold text-slate-400">
              這個分類目前沒有符合搜尋的商家
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-32 pt-[calc(0.25rem+env(safe-area-inset-top))]">
      <header className="pt-4">
        <div className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">資料管理</p>
          <h1 className="mt-2 text-[1.55rem] font-black leading-tight tracking-[-0.04em] text-slate-950">
            商家管理
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            編輯商家名稱、調整分類，讓交易表單裡的商家維持一致。
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-[1.15rem] border border-[#ece4d8] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="text-[0.65rem] font-black tracking-[0.16em] text-slate-400">分類</div>
            <div className="mt-1 text-lg font-black text-slate-900">{groups.length}</div>
          </div>
          <div className="rounded-[1.15rem] border border-[#ece4d8] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="text-[0.65rem] font-black tracking-[0.16em] text-slate-400">商家</div>
            <div className="mt-1 text-lg font-black text-slate-900">{merchants.length}</div>
          </div>
          <div className="rounded-[1.15rem] border border-[#ece4d8] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="text-[0.65rem] font-black tracking-[0.16em] text-slate-400">未分類</div>
            <div className="mt-1 text-lg font-black text-slate-900">{unassignedMerchantCount}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-[1.25rem] bg-[#f4f1ea] p-1">
          {MERCHANT_VIEWS.map((item) => {
            const isActive = view === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id)
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

      {notice ? (
        <div
          className={`mt-4 rounded-[1.1rem] px-4 py-3 text-sm font-black shadow-[0_12px_24px_rgba(15,23,42,0.06)] ${
            notice.tone === 'success'
              ? 'bg-[#ebfff7] text-[#187d5f]'
              : 'bg-[#fff3f2] text-[#c2413a]'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {view === 'merchants' ? (
          <section className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
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
                  value={newMerchantGroupId}
                  onChange={(event) => setNewMerchantGroupId(event.target.value)}
                  className="min-w-0 flex-1 rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-3 text-sm font-black text-slate-700 outline-none"
                  aria-label="新增商家分類"
                >
                  {groupOptions.map((option) => (
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
          </section>
        ) : (
          <section className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
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
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                onKeyDown={(event) => handleEnter(event, handleCreateGroup)}
                placeholder="分類名稱"
                className="ios-search-input w-full rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-3 text-sm font-black text-slate-950 outline-none placeholder:text-slate-400"
                aria-label="新增商家分類"
              />
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={pendingKey === 'create-group'}
                className="w-full rounded-[1rem] bg-[#f6d36a] px-4 py-3 text-sm font-black text-slate-950 shadow-[0_14px_28px_rgba(246,211,106,0.28)] disabled:opacity-50"
              >
                新增分類
              </button>
            </div>
          </section>
        )}

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
                {view === 'merchants'
                  ? filteredGroups.length + (filteredUnassignedMerchants.length > 0 ? 1 : 0)
                  : filteredGroups.length} 區塊
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

        {view === 'merchants' && recentMerchants.length > 0 ? (
          <section className="overflow-hidden rounded-[1.7rem] border border-[#eee5d8] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between border-b border-[#f2ece2] px-4 py-3">
              <div>
                <div className="text-sm font-black text-slate-900">最近使用</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-400">點一下可直接帶回上方快速新增</div>
              </div>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-4">
              {recentMerchants.map((merchant) => (
                <button
                  key={merchant.id}
                  type="button"
                  onClick={() => {
                    setNewMerchantName(merchant.name)
                    setNewMerchantGroupId(merchant.group_id ?? '')
                    setNotice(null)
                    focusMerchantComposer(merchant.group_id ?? undefined)
                  }}
                  className="shrink-0 rounded-full border border-[#eadfce] bg-[#fcfbf8] px-4 py-2 text-left text-sm font-black text-slate-700 transition active:scale-[0.98]"
                >
                  {merchant.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {view === 'merchants' && (filteredUnassignedMerchants.length > 0 || (!normalizedQuery && unassignedMerchantCount > 0)) ? (
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
              {(normalizedQuery ? filteredUnassignedMerchants : groupedMerchants.unassigned).length > 0 ? (
                (normalizedQuery ? filteredUnassignedMerchants : groupedMerchants.unassigned).map((merchant) =>
                  renderMerchantRow(merchant),
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
          filteredGroups.map((group) => renderGroupRow(group))
        ) : (
          <div className="rounded-[1.7rem] border border-dashed border-[#e3d9c6] bg-white px-4 py-10 text-center text-sm font-bold text-slate-400">
            沒有符合搜尋的分類
          </div>
        )}
      </div>
    </div>
  )
}
