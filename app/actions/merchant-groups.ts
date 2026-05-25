'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FamilyMerchant, FamilyMerchantGroup } from '@/lib/family-transactions'

type MerchantGroupMutationResult =
  | { ok: true; group: FamilyMerchantGroup }
  | { ok: false; error: string }

type MerchantMutationResult =
  | { ok: true; merchant: FamilyMerchant }
  | { ok: false; error: string }

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeMerchantName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-TW')
}

function normalizeMerchantGroupError(message: string) {
  if (message.includes('family_merchant_groups_name_unique')) {
    return '這個商家分類名稱已經存在。'
  }

  if (message.includes('violates foreign key constraint')) {
    return '找不到指定的商家或分類，請重新整理後再試。'
  }

  return message
}

function revalidateMerchantConsumers() {
  revalidatePath('/ledger')
  revalidatePath('/ledger/new')
}

async function resolveMerchantGroup(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  groupId: string | null,
) {
  if (!groupId) return { ok: true as const, groupId: null }

  const { data: group, error } = await supabase
    .from('family_merchant_groups')
    .select('id, is_archived')
    .eq('id', groupId)
    .maybeSingle()

  if (error) return { ok: false as const, error: normalizeMerchantGroupError(error.message) }
  if (!group || group.is_archived) {
    return { ok: false as const, error: '找不到指定的商家分類。' }
  }

  return { ok: true as const, groupId }
}

export async function createMerchantGroup(name: string): Promise<MerchantGroupMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const normalized = normalizeName(name)
  if (!normalized) return fail('商家分類名稱不能空白。')

  const { data: lastGroup, error: orderError } = await supabase
    .from('family_merchant_groups')
    .select('sort_order')
    .eq('is_archived', false)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (orderError) return fail(normalizeMerchantGroupError(orderError.message))

  const { data, error } = await supabase
    .from('family_merchant_groups')
    .insert({
      name: normalized,
      sort_order: Number(lastGroup?.sort_order ?? 0) + 1,
      is_archived: false,
    })
    .select('id, name, sort_order, is_archived, created_at, updated_at')
    .single()

  if (error) return fail(normalizeMerchantGroupError(error.message))

  revalidateMerchantConsumers()
  return { ok: true, group: data as FamilyMerchantGroup }
}

export async function renameMerchantGroup(input: {
  id: string
  name: string
}): Promise<MerchantGroupMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const normalized = normalizeName(input.name)
  if (!normalized) return fail('商家分類名稱不能空白。')

  const { data, error } = await supabase
    .from('family_merchant_groups')
    .update({ name: normalized })
    .eq('id', input.id)
    .eq('is_archived', false)
    .select('id, name, sort_order, is_archived, created_at, updated_at')
    .single()

  if (error) return fail(normalizeMerchantGroupError(error.message))

  revalidateMerchantConsumers()
  return { ok: true, group: data as FamilyMerchantGroup }
}

export async function archiveMerchantGroup(id: string): Promise<MerchantGroupMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const { data: group, error: groupError } = await supabase
    .from('family_merchant_groups')
    .select('id, is_archived')
    .eq('id', id)
    .maybeSingle()

  if (groupError) return fail(normalizeMerchantGroupError(groupError.message))
  if (!group || group.is_archived) return fail('找不到這個商家分類。')

  const { error: unassignError } = await supabase
    .from('family_merchants')
    .update({ group_id: null })
    .eq('group_id', id)

  if (unassignError) return fail(normalizeMerchantGroupError(unassignError.message))

  const { data, error } = await supabase
    .from('family_merchant_groups')
    .update({ is_archived: true })
    .eq('id', id)
    .select('id, name, sort_order, is_archived, created_at, updated_at')
    .single()

  if (error) return fail(normalizeMerchantGroupError(error.message))

  revalidateMerchantConsumers()
  return { ok: true, group: data as FamilyMerchantGroup }
}

export async function updateMerchantGroup(input: {
  merchantId: string
  groupId: string | null
}): Promise<MerchantMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const groupId = input.groupId || null
  if (groupId) {
    const { data: group, error: groupError } = await supabase
      .from('family_merchant_groups')
      .select('id, is_archived')
      .eq('id', groupId)
      .maybeSingle()

    if (groupError) return fail(normalizeMerchantGroupError(groupError.message))
    if (!group || group.is_archived) return fail('找不到指定的商家分類。')
  }

  const { data, error } = await supabase
    .from('family_merchants')
    .update({ group_id: groupId })
    .eq('id', input.merchantId)
    .eq('is_archived', false)
    .select('id, name, group_id, last_used_at, is_archived, created_at')
    .single()

  if (error) return fail(normalizeMerchantGroupError(error.message))

  revalidateMerchantConsumers()
  return { ok: true, merchant: data as FamilyMerchant }
}

export async function updateMerchant(input: {
  merchantId: string
  name: string
  groupId: string | null
}): Promise<MerchantMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const normalizedName = normalizeName(input.name)
  if (!normalizedName) return fail('商家名稱不能空白。')

  const normalizedMerchant = normalizeMerchantName(normalizedName)
  const { data: existing, error: existingError } = await supabase
    .from('family_merchants')
    .select('id, group_id, is_archived, normalized_name')
    .eq('id', input.merchantId)
    .maybeSingle()

  if (existingError) return fail(normalizeMerchantGroupError(existingError.message))
  if (!existing || existing.is_archived) return fail('找不到這個商家。')

  const { data: duplicate, error: duplicateError } = await supabase
    .from('family_merchants')
    .select('id')
    .eq('normalized_name', normalizedMerchant)
    .neq('id', input.merchantId)
    .maybeSingle()

  if (duplicateError) return fail(normalizeMerchantGroupError(duplicateError.message))
  if (duplicate) return fail('這個商家名稱已經存在。')

  const groupId = input.groupId || null
  if (groupId) {
    const { data: group, error: groupError } = await supabase
      .from('family_merchant_groups')
      .select('id, is_archived')
      .eq('id', groupId)
      .maybeSingle()

    if (groupError) return fail(normalizeMerchantGroupError(groupError.message))
    if (!group || group.is_archived) return fail('找不到指定的商家分類。')
  }

  const { data, error } = await supabase
    .from('family_merchants')
    .update({
      name: normalizedName,
      normalized_name: normalizedMerchant,
      group_id: groupId,
    })
    .eq('id', input.merchantId)
    .eq('is_archived', false)
    .select('id, name, group_id, last_used_at, is_archived, created_at')
    .single()

  if (error) return fail(normalizeMerchantGroupError(error.message))

  const { error: txError } = await supabase
    .from('family_transactions')
    .update({ merchant: normalizedName })
    .eq('merchant_id', input.merchantId)

  if (txError) return fail(normalizeMerchantGroupError(txError.message))

  revalidateMerchantConsumers()
  return { ok: true, merchant: data as FamilyMerchant }
}

export async function createMerchant(input: {
  name: string
  groupId: string | null
}): Promise<MerchantMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const normalizedName = normalizeName(input.name)
  if (!normalizedName) return fail('商家名稱不能空白。')

  const normalizedMerchant = normalizeMerchantName(normalizedName)
  const { data: existing, error: existingError } = await supabase
    .from('family_merchants')
    .select('id, group_id, is_archived, normalized_name')
    .eq('normalized_name', normalizedMerchant)
    .maybeSingle()

  if (existingError) return fail(normalizeMerchantGroupError(existingError.message))
  if (existing && !existing.is_archived) return fail('這個商家名稱已經存在。')

  const resolvedGroup = await resolveMerchantGroup(supabase, input.groupId || null)
  if (!resolvedGroup.ok) return fail(resolvedGroup.error)

  const { data, error } = await supabase
    .from('family_merchants')
    .insert({
      name: normalizedName,
      normalized_name: normalizedMerchant,
      group_id: resolvedGroup.groupId,
      last_used_at: new Date().toISOString(),
      is_archived: false,
    })
    .select('id, name, group_id, last_used_at, is_archived, created_at')
    .single()

  if (error) return fail(normalizeMerchantGroupError(error.message))

  revalidateMerchantConsumers()
  return { ok: true, merchant: data as FamilyMerchant }
}
