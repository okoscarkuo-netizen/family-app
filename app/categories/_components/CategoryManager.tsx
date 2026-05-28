'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  archiveCategory,
  createCategory,
  updateCategory,
} from '@/app/actions/categories'
import {
  buildCategoryPickerGroups,
  type CategoryPickerGroup,
  type FamilyCategory,
  type TransactionKind,
} from '@/lib/family-transactions'
import {
  CATEGORY_ICON_CHOICES,
  getCategoryDisplayIcon,
  normalizeCategoryIcon,
} from '@/lib/category-icons'

type Props = {
  initialCategories: FamilyCategory[]
}

const KINDS: TransactionKind[] = ['expense', 'income', 'transfer']

const KIND_LABELS: Record<TransactionKind, string> = {
  expense: '支出',
  income: '收入',
  transfer: '轉帳',
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path
        d="m15 19-7-7 7-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export function CategoryManager({ initialCategories }: Props) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [kind, setKind] = useState<TransactionKind>('expense')
  const [query, setQuery] = useState('')
  const [rootName, setRootName] = useState('')
  const [childNames, setChildNames] = useState<Record<string, string>>({})
  const [addingChildParentId, setAddingChildParentId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingIconDraft, setEditingIconDraft] = useState('')
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const groups = buildCategoryPickerGroups(categories, kind)
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW')
  const filteredGroups = normalizedQuery
    ? groups
        .map((group) => {
          const parentMatches = group.parent.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery)
          const children = group.children.filter((child) =>
            parentMatches || child.name.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
          )
          return parentMatches || children.length > 0 ? { ...group, children } : null
        })
        .filter((group): group is CategoryPickerGroup => group !== null)
    : groups

  function handleEnter(event: KeyboardEvent<HTMLInputElement>, action: () => void) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    action()
  }

  function upsertCategory(category: FamilyCategory) {
    setCategories((current) => {
      const existingIndex = current.findIndex((item) => item.id === category.id)
      if (existingIndex === -1) return [...current, category]
      return current.map((item) => (item.id === category.id ? category : item))
    })
    router.refresh()
  }

  function archiveCategories(archivedIds: string[]) {
    const archivedIdSet = new Set(archivedIds)
    setCategories((current) =>
      current.map((category) =>
        archivedIdSet.has(category.id) ? { ...category, is_archived: true } : category,
      ),
    )
    router.refresh()
  }

  async function handleCreate(name: string, parentId: string | null) {
    const normalizedName = name.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '分類名稱不能空白。' })
      return
    }

    const key = parentId ? `create-child-${parentId}` : 'create-root'
    setPendingKey(key)
    setNotice(null)

    try {
      const result = await createCategory({ kind, name: normalizedName, parentId })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      upsertCategory(result.category)
      if (parentId) {
        setChildNames((current) => ({ ...current, [parentId]: '' }))
        setAddingChildParentId(null)
      } else {
        setRootName('')
      }
      setNotice({ tone: 'success', text: '分類已新增。' })
    } finally {
      setPendingKey(null)
    }
  }

  async function handleSaveCategory() {
    if (!editingId) return

    const normalizedName = editingName.trim()
    if (!normalizedName) {
      setNotice({ tone: 'error', text: '分類名稱不能空白。' })
      return
    }

    setPendingKey(`update-${editingId}`)
    setNotice(null)

    try {
      const result = await updateCategory({ id: editingId, name: normalizedName, icon: editingIconDraft })
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      upsertCategory(result.category)
      setEditingId(null)
      setEditingName('')
      setEditingIconDraft('')
      setNotice({ tone: 'success', text: '分類已更新。' })
    } finally {
      setPendingKey(null)
    }
  }

  async function handleArchive(category: FamilyCategory) {
    const message = category.parent_id
      ? `封存「${category.name}」？`
      : `封存「${category.name}」與底下所有二級分類？`
    if (!window.confirm(message)) return

    setPendingKey(`archive-${category.id}`)
    setNotice(null)

    try {
      const result = await archiveCategory(category.id)
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }

      archiveCategories(result.archivedIds)
      setNotice({ tone: 'success', text: '分類已封存。' })
    } finally {
      setPendingKey(null)
    }
  }

  function startEditing(category: FamilyCategory) {
    setEditingId(category.id)
    setEditingName(category.name)
    setEditingIconDraft(category.icon ?? '')
    setNotice(null)
  }

  function renderCategoryRow(category: FamilyCategory, depth: 'parent' | 'child') {
    const isEditing = editingId === category.id
    const isPending =
      pendingKey === `update-${category.id}` ||
      pendingKey === `archive-${category.id}`
    const previewIcon = normalizeCategoryIcon(editingIconDraft) || getCategoryDisplayIcon(category)

    return (
      <div
        key={category.id}
        className={`border-b border-[#f0ece5] bg-white ${depth === 'child' ? 'pl-10' : ''}`}
      >
        {isEditing ? (
          <div className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] border border-[#e3e4e8] bg-[#f7f7f5] text-[0.82rem] font-black tracking-[-0.02em] text-[#5e646d]">
                {previewIcon}
              </div>

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => handleEnter(event, handleSaveCategory)}
                  className="min-w-0 w-full rounded-[1rem] border border-[#eadfce] bg-[#fcfbf8] px-3 py-2 text-[1rem] font-black text-slate-950 outline-none"
                  aria-label="分類名稱"
                  autoFocus
                />

                <div className="mt-2 rounded-[1rem] border border-[#ece5d9] bg-[#fbfaf7] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[0.65rem] font-black tracking-[0.16em] text-slate-400">符號</div>
                    <input
                      type="text"
                      value={editingIconDraft}
                      onChange={(event) => setEditingIconDraft(event.target.value.slice(0, 3))}
                      className="w-24 rounded-full border border-transparent bg-white/80 px-3 py-1.5 text-right text-sm font-black text-slate-950 outline-none placeholder:text-slate-400"
                      placeholder="留空"
                      aria-label="分類符號"
                    />
                  </div>

                  <div className="mt-2 max-h-28 overflow-y-auto pr-1">
                    <div className="grid grid-cols-6 gap-2">
                      {CATEGORY_ICON_CHOICES.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => setEditingIconDraft(choice)}
                          className={`flex h-9 items-center justify-center rounded-[0.85rem] border text-[0.92rem] font-black transition ${
                            normalizeCategoryIcon(editingIconDraft) === choice
                              ? 'border-slate-950 bg-slate-950 text-white'
                              : 'border-[#e3e4e8] bg-[#f7f7f5] text-[#5e646d]'
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingIconDraft('')}
                      className="rounded-full bg-[#f4f4f2] px-3 py-1.5 text-xs font-black text-slate-600"
                    >
                      恢復預設
                    </button>
                    <div className="text-xs font-medium text-[#b0b4b9]">留空會改回預設符號</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={handleSaveCategory}
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
                  setEditingIconDraft('')
                }}
                disabled={Boolean(pendingKey)}
                className="rounded-full bg-[#f4f1ea] px-3 py-2 text-xs font-black text-slate-500 disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[4.35rem] items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] border border-[#e3e4e8] bg-[#f7f7f5] text-[0.82rem] font-black tracking-[-0.02em] text-[#5e646d]">
              {getCategoryDisplayIcon(category)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[1rem] font-black text-slate-900">{category.name}</div>
              <div className="mt-0.5 text-xs font-bold text-slate-400">
                {depth === 'parent' ? '一級分類' : '二級分類'}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {depth === 'parent' ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddingChildParentId(category.id)
                    setNotice(null)
                  }}
                  disabled={Boolean(pendingKey)}
                  className="rounded-full bg-[#f2fbf7] px-3 py-2 text-xs font-black text-[#16866d] disabled:opacity-50"
                >
                  二級
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => startEditing(category)}
                disabled={Boolean(pendingKey)}
                className="rounded-full bg-[#f4f1ea] px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
              >
                修改
              </button>
              <button
                type="button"
                onClick={() => handleArchive(category)}
                disabled={isPending || Boolean(pendingKey)}
                className="rounded-full bg-[#fff1ee] px-3 py-2 text-xs font-black text-[#c9563f] disabled:opacity-50"
              >
                封存
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
        <div className="flex h-[4.5rem] items-center gap-3 px-4">
          <Link
            href="/more"
            aria-label="返回更多"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#202124] transition hover:bg-[#f4f4f2]"
          >
            <BackIcon />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.35rem] font-semibold tracking-normal text-[#202124]">
              分類管理
            </h1>
            <p className="mt-1 truncate text-xs font-medium text-[#b5b8bc]">
              新增、修改、封存收支與轉帳分類
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-[#f5f5f3] px-1">
          {KINDS.map((item) => {
            const isActive = item === kind
            return (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                aria-pressed={isActive}
                className={`relative py-2 text-center text-[0.92rem] font-black transition ${
                  isActive ? 'text-slate-950' : 'text-slate-400'
                }`}
              >
                {KIND_LABELS[item]}
                {isActive ? (
                  <span className="absolute inset-x-8 -bottom-px h-0.5 rounded-full bg-[#f2b232]" />
                ) : null}
              </button>
            )
          })}
        </div>
      </header>

      <div className="px-4 py-3">
        <label className="flex min-h-11 items-center gap-2 rounded-full bg-[#f3f3f2] px-4">
          <span aria-hidden="true" className="text-lg text-slate-400">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋分類"
            className="ios-search-input min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none placeholder:text-slate-400"
            aria-label="搜尋分類"
          />
        </label>

        <div className="mt-3 flex items-center gap-2 rounded-[1.25rem] border border-[#efe7dc] bg-[#fcfbf8] p-2">
          <input
            type="text"
            value={rootName}
            onChange={(event) => setRootName(event.target.value)}
            onKeyDown={(event) => handleEnter(event, () => handleCreate(rootName, null))}
            placeholder={`新增 ${KIND_LABELS[kind]} 一級分類`}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-slate-950 outline-none placeholder:text-slate-400"
            aria-label="新增一級分類"
          />
          <button
            type="button"
            onClick={() => handleCreate(rootName, null)}
            disabled={pendingKey === 'create-root'}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            新增
          </button>
        </div>

        {notice ? (
          <div
            className={`mt-3 rounded-[1rem] px-3 py-2 text-sm font-black ${
              notice.tone === 'success'
                ? 'bg-[#ebfff7] text-[#187d5f]'
                : 'bg-[#fff3f2] text-[#c2413a]'
            }`}
          >
            {notice.text}
          </div>
        ) : null}
      </div>

      <div className="pb-4">
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => (
            <section key={group.parent.id} className="mt-3 border-y border-[#f1ede6]">
              {renderCategoryRow(group.parent, 'parent')}

              {addingChildParentId === group.parent.id ? (
                <div className="flex min-h-[4.1rem] items-center gap-2 border-b border-[#f0ece5] bg-[#fffdf9] px-4 pl-10">
                  <input
                    type="text"
                    value={childNames[group.parent.id] ?? ''}
                    onChange={(event) =>
                      setChildNames((current) => ({
                        ...current,
                        [group.parent.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) =>
                      handleEnter(event, () =>
                        handleCreate(childNames[group.parent.id] ?? '', group.parent.id),
                      )
                    }
                    placeholder={`新增「${group.parent.name}」二級分類`}
                    className="min-w-0 flex-1 rounded-[1rem] border border-[#eadfce] bg-white px-3 py-2 text-sm font-black text-slate-950 outline-none placeholder:text-slate-400"
                    aria-label="新增二級分類"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleCreate(childNames[group.parent.id] ?? '', group.parent.id)}
                    disabled={pendingKey === `create-child-${group.parent.id}`}
                    className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    新增
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingChildParentId(null)}
                    disabled={Boolean(pendingKey)}
                    className="rounded-full bg-[#f4f1ea] px-3 py-2 text-xs font-black text-slate-500 disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              ) : null}

              {group.children.map((child) => renderCategoryRow(child, 'child'))}
            </section>
          ))
        ) : (
          <div className="px-5 py-12 text-center text-sm font-bold text-slate-400">
            {normalizedQuery ? '沒有符合搜尋的分類' : `還沒有 ${KIND_LABELS[kind]} 分類，從上方新增`}
          </div>
        )}
      </div>

    </div>
  )
}
