'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { DATA_CACHE_TAGS } from '@/lib/data-cache'
import type { FamilyCategory, TransactionKind } from '@/lib/family-transactions'
import { getDefaultCategoryIcon, normalizeCategoryIcon } from '@/lib/category-icons'

export type CategoryMutationResult =
  | { ok: true; category: FamilyCategory }
  | { ok: false; error: string }

export type ArchiveCategoryResult =
  | { ok: true; archivedIds: string[] }
  | { ok: false; error: string }

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function fail(error: string) {
  return { ok: false as const, error }
}

function normalizeCategoryError(message: string) {
  if (message.includes('family_categories_kind_parent_name_unique')) {
    return '這個分類名稱已經存在，請換一個名稱。'
  }

  if (message.includes('violates foreign key constraint')) {
    return '找不到指定的一級分類，請重新整理後再試。'
  }

  return message
}

function revalidateCategoryConsumers() {
  revalidateTag(DATA_CACHE_TAGS.categories, 'max')
  revalidatePath('/ledger')
  revalidatePath('/ledger/new')
  revalidatePath('/accounts')
}

export async function createCategory(input: {
  kind: TransactionKind
  name: string
  parentId?: string | null
}): Promise<CategoryMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const name = normalizeCategoryName(input.name)
  if (!name) return fail('分類名稱不能空白。')
  if (!['income', 'expense', 'transfer'].includes(input.kind)) {
    return fail('分類類型不正確。')
  }

  const parentId = input.parentId || null
  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from('family_categories')
      .select('id, kind, parent_id, is_archived')
      .eq('id', parentId)
      .maybeSingle()

    if (parentError) return fail(normalizeCategoryError(parentError.message))
    if (!parent || parent.is_archived || parent.kind !== input.kind || parent.parent_id) {
      return fail('二級分類必須放在有效的一級分類底下。')
    }
  }

  let orderQuery = supabase
    .from('family_categories')
    .select('sort_order')
    .eq('kind', input.kind)
    .eq('is_archived', false)
    .order('sort_order', { ascending: false })
    .limit(1)

  orderQuery = parentId ? orderQuery.eq('parent_id', parentId) : orderQuery.is('parent_id', null)

  const { data: lastSibling, error: orderError } = await orderQuery.maybeSingle()

  if (orderError) return fail(normalizeCategoryError(orderError.message))

  const { data, error } = await supabase
    .from('family_categories')
    .insert({
      name,
      kind: input.kind,
      icon: getDefaultCategoryIcon(`${input.kind}:${parentId ?? 'root'}:${name}`),
      parent_id: parentId,
      sort_order: Number(lastSibling?.sort_order ?? 0) + 1,
      source_app: 'family-app',
      is_archived: false,
    })
    .select('id, name, kind, icon, color, parent_id, sort_order, is_archived')
    .single()

  if (error) return fail(normalizeCategoryError(error.message))

  revalidateCategoryConsumers()
  return { ok: true, category: data as FamilyCategory }
}

export async function updateCategoryIcon(input: {
  id: string
  icon: string
}): Promise<CategoryMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const icon = normalizeCategoryIcon(input.icon)

  const { data, error } = await supabase
    .from('family_categories')
    .update({ icon: icon || null })
    .eq('id', input.id)
    .eq('is_archived', false)
    .select('id, name, kind, icon, color, parent_id, sort_order, is_archived')
    .single()

  if (error) return fail(normalizeCategoryError(error.message))

  revalidateCategoryConsumers()
  return { ok: true, category: data as FamilyCategory }
}

export async function updateCategory(input: {
  id: string
  name: string
  icon: string
}): Promise<CategoryMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const name = normalizeCategoryName(input.name)
  if (!name) return fail('分類名稱不能空白。')

  const icon = normalizeCategoryIcon(input.icon)

  const { data, error } = await supabase
    .from('family_categories')
    .update({ name, icon: icon || null })
    .eq('id', input.id)
    .eq('is_archived', false)
    .select('id, name, kind, icon, color, parent_id, sort_order, is_archived')
    .single()

  if (error) return fail(normalizeCategoryError(error.message))

  revalidateCategoryConsumers()
  return { ok: true, category: data as FamilyCategory }
}

export async function renameCategory(input: {
  id: string
  name: string
}): Promise<CategoryMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const name = normalizeCategoryName(input.name)
  if (!name) return fail('分類名稱不能空白。')

  const { data, error } = await supabase
    .from('family_categories')
    .update({ name })
    .eq('id', input.id)
    .eq('is_archived', false)
    .select('id, name, kind, icon, color, parent_id, sort_order, is_archived')
    .single()

  if (error) return fail(normalizeCategoryError(error.message))

  revalidateCategoryConsumers()
  return { ok: true, category: data as FamilyCategory }
}

export async function archiveCategory(id: string): Promise<ArchiveCategoryResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const { data: category, error: categoryError } = await supabase
    .from('family_categories')
    .select('id, parent_id, is_archived')
    .eq('id', id)
    .maybeSingle()

  if (categoryError) return fail(normalizeCategoryError(categoryError.message))
  if (!category || category.is_archived) return fail('找不到這個分類。')

  const archivedIds = [category.id as string]
  if (!category.parent_id) {
    const { data: children, error: childError } = await supabase
      .from('family_categories')
      .select('id')
      .eq('parent_id', category.id)
      .eq('is_archived', false)

    if (childError) return fail(normalizeCategoryError(childError.message))
    archivedIds.push(...(children ?? []).map((child) => child.id as string))
  }

  const { error } = await supabase
    .from('family_categories')
    .update({ is_archived: true })
    .in('id', archivedIds)

  if (error) return fail(normalizeCategoryError(error.message))

  revalidateCategoryConsumers()
  return { ok: true, archivedIds }
}
