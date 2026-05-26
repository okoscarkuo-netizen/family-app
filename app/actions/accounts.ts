'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  supportsFavoriteColumn,
  supportsOpeningBalanceColumn,
  supportsRemarkColumn,
  supportsBalanceDateColumn,
} from '@/lib/accounts-db'
import {
  setFavoriteAccountForHousehold,
  resolveCurrentHouseholdId,
  setAccountOpeningBalancesForHousehold,
} from '@/lib/account-opening-balance-store'
import { getAccountGroup, normalizeAccountType, normalizeOwner } from '@/lib/finance/types'

const VALID_CURRENCIES = new Set(['TWD', 'USD', 'JPY'])

function getString(formData: FormData, key: string, fallback = ''): string {
  return String(formData.get(key) ?? fallback).trim()
}

function getBoolean(formData: FormData, key: string) {
  const value = formData.get(key)
  return value === 'true' || value === 'on'
}

function nullableStr(val: FormDataEntryValue | null): string | null {
  const value = val ? String(val).trim() : ''
  return value ? value : null
}

function getNumber(formData: FormData, key: string, fallback?: number) {
  const raw = formData.get(key)
  if (raw === null || raw === undefined || raw === '') {
    if (typeof fallback === 'number') return fallback
    throw new Error('請輸入有效的餘額')
  }

  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error('請輸入有效的餘額')
  }

  return value
}

function resolveOwnership(formData: FormData) {
  const selectedOwner = getString(formData, 'owner') || 'Oscar'

  if (selectedOwner === 'shared') {
    return {
      owner: '共同',
      shared: true,
    }
  }

  return {
    owner: normalizeOwner(selectedOwner || 'Oscar'),
    shared: getBoolean(formData, 'shared'),
  }
}

function roundBalance(value: number) {
  return Math.round(value * 100) / 100
}

function readBalanceInputs(formData: FormData) {
  const balance = roundBalance(getNumber(formData, 'balance'))
  const hasOpeningBalance = formData.has('opening_balance')
  const openingBalance = hasOpeningBalance
    ? roundBalance(getNumber(formData, 'opening_balance', balance))
    : balance

  return {
    balance,
    openingBalance,
    hasOpeningBalance,
  }
}

async function saveOpeningBalanceFallback(accountId: string, openingBalance: number) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const householdId = await resolveCurrentHouseholdId()
  if (!householdId) return

  await setAccountOpeningBalancesForHousehold(supabase, householdId, {
    [accountId]: roundBalance(openingBalance),
  })
}

function revalidateAccountBalanceSurfaces(id: string) {
  revalidatePath('/')
  revalidatePath('/accounts')
  revalidatePath('/ledger')
  revalidatePath('/ledger/new')
  revalidatePath(`/ledger/${encodeURIComponent(id)}/edit`)
  revalidatePath(`/accounts/${encodeURIComponent(id)}`)
}

export async function createAccount(formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')
  const [supportsOpeningBalance, supportsFavorite] = await Promise.all([
    supportsOpeningBalanceColumn(),
    supportsFavoriteColumn(),
  ])

  const name = getString(formData, 'name')
  if (!name) throw new Error('名稱必填')

  const currency = VALID_CURRENCIES.has(getString(formData, 'currency'))
    ? getString(formData, 'currency')
    : 'TWD'
  const kind = getString(formData, 'kind') === 'liability' ? 'liability' : 'asset'
  const balance = roundBalance(getNumber(formData, 'balance', 0))
  const openingBalance = formData.has('opening_balance')
    ? roundBalance(getNumber(formData, 'opening_balance', balance))
    : balance
  const ownership = resolveOwnership(formData)
  const remark = nullableStr(formData.get('remark'))
  const favorite = getBoolean(formData, 'favorite')

  const { data: maxRow } = await supabase
    .from('family_accounts')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sortOrder = (maxRow?.sort_order ?? 0) + 1

  const id = `manual-${Date.now()}-${name.slice(0, 20).replace(/\s+/g, '-')}`

  const payload: Record<string, string | number | boolean | null> = {
    id,
    name,
    type: normalizeAccountType(getString(formData, 'type') || '現金'),
    owner: ownership.owner,
    kind,
    balance: roundBalance(balance),
    currency,
    shared: ownership.shared,
    hidden: formData.get('hidden') === 'true',
    remark,
    sort_order: sortOrder,
    is_archived: false,
  }

  if (supportsFavorite) {
    payload.favorite = favorite
  }

  if (supportsOpeningBalance) {
    payload.opening_balance = roundBalance(openingBalance)
  }

  const { error } = await supabase.from('family_accounts').insert(payload)

  if (error) throw new Error(error.message)

  if (!supportsOpeningBalance) {
    await saveOpeningBalanceFallback(id, openingBalance)
  }

  if (!supportsFavorite) {
    const householdId = await resolveCurrentHouseholdId()
    if (householdId) {
      await setFavoriteAccountForHousehold(supabase, householdId, id, favorite)
    }
  }

  revalidatePath('/accounts')
}

export async function updateAccount(id: string, formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')
  const [supportsOpeningBalance, supportsRemark, supportsFavorite] = await Promise.all([
    supportsOpeningBalanceColumn(),
    supportsRemarkColumn(),
    supportsFavoriteColumn(),
  ])

  const name = getString(formData, 'name')
  if (!name) throw new Error('名稱必填')

  const currency = VALID_CURRENCIES.has(getString(formData, 'currency'))
    ? getString(formData, 'currency')
    : 'TWD'
  const ownership = resolveOwnership(formData)
  const updates: Record<string, string | number | boolean | null> = {
    name,
    type: normalizeAccountType(getString(formData, 'type') || '現金'),
    owner: ownership.owner,
    shared: ownership.shared,
    currency,
    hidden: formData.get('hidden') === 'true',
  }

  if (supportsFavorite) {
    updates.favorite = getBoolean(formData, 'favorite')
  }

  if (supportsRemark) {
    updates.remark = nullableStr(formData.get('remark'))
  }

  if (formData.has('kind')) {
    updates.kind = getString(formData, 'kind') === 'liability' ? 'liability' : 'asset'
  }

  if (formData.has('balance') || formData.has('opening_balance')) {
    const { balance, openingBalance, hasOpeningBalance } = readBalanceInputs(formData)
    updates.balance = balance

    if (supportsOpeningBalance) {
      updates.opening_balance = openingBalance
    }

    const { error } = await supabase
      .from('family_accounts')
      .update(updates)
      .eq('id', id)

    if (error) throw new Error(error.message)

    if (!supportsOpeningBalance && hasOpeningBalance) {
      await saveOpeningBalanceFallback(id, openingBalance)
    }

    revalidateAccountBalanceSurfaces(id)
    return
  }

  const { error } = await supabase
    .from('family_accounts')
    .update(updates)
    .eq('id', id)

  if (error) throw new Error(error.message)

  if (!supportsFavorite) {
    const householdId = await resolveCurrentHouseholdId()
    if (householdId) {
      await setFavoriteAccountForHousehold(
        supabase,
        householdId,
        id,
        getBoolean(formData, 'favorite'),
      )
    }
  }
  revalidateAccountBalanceSurfaces(id)
}

export async function archiveAccount(id: string) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const { error } = await supabase
    .from('family_accounts')
    .update({ is_archived: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}

export async function setAccountBalance(id: string, formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')
  const [supportsOpeningBalance, supportsBalanceDate] = await Promise.all([
    supportsOpeningBalanceColumn(),
    supportsBalanceDateColumn(),
  ])
  const { balance, openingBalance } = readBalanceInputs(formData)
  const updates: Record<string, number | string | null> = { balance }

  if (supportsOpeningBalance) {
    updates.opening_balance = openingBalance
  }

  if (supportsBalanceDate) {
    const rawDate = getString(formData, 'balance_date')
    updates.balance_date = rawDate || null
  }

  const { error } = await supabase.from('family_accounts').update(updates).eq('id', id)

  if (error) throw new Error(error.message)

  if (!supportsOpeningBalance) {
    await saveOpeningBalanceFallback(id, openingBalance)
  }

  revalidateAccountBalanceSurfaces(id)
}

export async function pinCashAccount(id: string) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const { data: account, error: accountError } = await supabase
    .from('family_accounts')
    .select('id, name, type, owner, shared')
    .eq('id', id)
    .eq('is_archived', false)
    .single()

  if (accountError || !account) {
    throw new Error(accountError?.message ?? '找不到帳戶')
  }

  if (getAccountGroup(account) !== '現金與儲值') {
    throw new Error('只有現金帳戶可以置頂')
  }

  const { data: firstRow, error: firstRowError } = await supabase
    .from('family_accounts')
    .select('sort_order')
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstRowError) throw new Error(firstRowError.message)

  const sortOrder = Number(firstRow?.sort_order ?? 0) - 1
  const { error } = await supabase
    .from('family_accounts')
    .update({ sort_order: sortOrder })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath(`/accounts/${encodeURIComponent(id)}`)
}

export async function reorderAccounts(orderedAccountIds: string[]) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const uniqueIds = Array.from(new Set(orderedAccountIds.filter(Boolean)))
  if (uniqueIds.length === 0) return

  const { data: rows, error } = await supabase
    .from('family_accounts')
    .select('id, sort_order')
    .in('id', uniqueIds)
    .eq('is_archived', false)

  if (error) throw new Error(error.message)
  if (!rows || rows.length !== uniqueIds.length) {
    throw new Error('找不到部分帳戶，請重新整理後再試一次')
  }

  const baseSortOrder = Math.min(...rows.map((row) => Number(row.sort_order ?? 0)))

  for (let index = 0; index < uniqueIds.length; index += 1) {
    const id = uniqueIds[index]
    const sortOrder = baseSortOrder + index

    const { error: updateError } = await supabase
      .from('family_accounts')
      .update({ sort_order: sortOrder })
      .eq('id', id)

    if (updateError) throw new Error(updateError.message)
  }

  revalidatePath('/')
  revalidatePath('/accounts')
}
