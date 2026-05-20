import { createAdminClient } from '@/lib/supabase/admin'

export type TransactionKind = 'income' | 'expense' | 'transfer'
export type TransactionOwner = 'Oscar' | 'Livia'

export type FamilyCategory = {
  id: string
  name: string
  kind: TransactionKind
  icon: string | null
  color: string | null
  parent_id: string | null
  sort_order: number
  is_archived: boolean
}

export type CategoryPickerGroup = {
  parent: FamilyCategory
  children: FamilyCategory[]
}

export type FamilyTransaction = {
  id: string
  kind: TransactionKind
  title: string
  amount: number
  currency: string
  category_id: string | null
  merchant_id: string | null
  account_id: string | null
  to_account_id: string | null
  owner: TransactionOwner
  merchant: string | null
  occurred_at?: string
  occurred_on: string
  note: string | null
  created_at: string
  category?: Pick<FamilyCategory, 'id' | 'name' | 'kind' | 'parent_id'> | null
  categoryPath?: string | null
}

export type TransactionFormPreset = {
  kind: TransactionKind
  currency: string
  categoryId: string | null
  accountId: string | null
  toAccountId: string | null
  owner: TransactionOwner
}

export type GetTransactionsParams = {
  year?: number
  month?: number
  accountId?: string
}

export type FamilyMerchant = {
  id: string
  name: string
  last_used_at: string
  is_archived: boolean
  created_at: string
}

function compareCategories(a: FamilyCategory, b: FamilyCategory) {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order
  }

  return a.name.localeCompare(b.name, 'zh-TW')
}

export function buildCategoryPickerGroups(
  categories: FamilyCategory[],
  kind: TransactionKind,
): CategoryPickerGroup[] {
  const scopedCategories = categories
    .filter((category) => category.kind === kind && !category.is_archived)
    .sort(compareCategories)

  const rootCategories: FamilyCategory[] = []
  const categoriesByParentId = new Map<string, FamilyCategory[]>()
  const rootIds = new Set<string>()

  for (const category of scopedCategories) {
    if (!category.parent_id) {
      rootCategories.push(category)
      rootIds.add(category.id)
      continue
    }

    const existingChildren = categoriesByParentId.get(category.parent_id) ?? []
    existingChildren.push(category)
    categoriesByParentId.set(category.parent_id, existingChildren)
  }

  for (const category of scopedCategories) {
    if (category.parent_id && !rootIds.has(category.parent_id)) {
      rootCategories.push({ ...category, parent_id: null })
      rootIds.add(category.id)
    }
  }

  return rootCategories
    .sort(compareCategories)
    .map((parent) => ({
      parent,
      children: (categoriesByParentId.get(parent.id) ?? []).sort(compareCategories),
    }))
}

export function getCategoryPath(
  categoryId: string | null | undefined,
  categories: FamilyCategory[],
): string | null {
  if (!categoryId) return null

  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const category = categoriesById.get(categoryId)
  if (!category) return null

  if (!category.parent_id) return category.name

  const parent = categoriesById.get(category.parent_id)
  return parent ? `${parent.name} › ${category.name}` : category.name
}

export async function getCategories(kind?: TransactionKind): Promise<FamilyCategory[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from('family_categories')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order')

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as FamilyCategory[]
}

export async function getAllCategories(): Promise<FamilyCategory[]> {
  return getCategories()
}

export async function getRecentMerchants(limit = 16): Promise<FamilyMerchant[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('family_merchants')
    .select('id, name, last_used_at, is_archived, created_at')
    .eq('is_archived', false)
    .order('last_used_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message.includes('family_merchants')) return []
    throw new Error(error.message)
  }

  return (data ?? []) as FamilyMerchant[]
}

export async function getLatestTransactionPreset(): Promise<TransactionFormPreset | null> {
  const supabase = createAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('family_transactions')
    .select('kind, currency, category_id, account_id, to_account_id, owner')
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    kind: data.kind as TransactionKind,
    currency: data.currency,
    categoryId: data.category_id,
    accountId: data.account_id,
    toAccountId: data.to_account_id,
    owner: data.owner as TransactionOwner,
  }
}

export async function getTransactions(params: GetTransactionsParams = {}): Promise<FamilyTransaction[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from('family_transactions')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.year && params.month) {
    const y = params.year
    const m = String(params.month).padStart(2, '0')
    const lastDay = new Date(y, params.month, 0).getDate()
    query = query
      .gte('occurred_on', `${y}-${m}-01`)
      .lte('occurred_on', `${y}-${m}-${lastDay}`)
  }

  if (params.accountId) {
    query = query.or(`account_id.eq.${params.accountId},to_account_id.eq.${params.accountId}`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const transactions = (data ?? []) as FamilyTransaction[]
  if (transactions.length === 0) return transactions

  const categories = await getAllCategories()
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return transactions.map((transaction) => {
    const category = transaction.category_id ? categoriesById.get(transaction.category_id) ?? null : null

    return {
      ...transaction,
      category,
      categoryPath: getCategoryPath(transaction.category_id, categories),
    }
  })
}
