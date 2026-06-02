import { createAdminClient } from '@/lib/supabase/admin'

let transactionRecurringColumnSupported: boolean | null = null

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
  transfer_target_amount?: number | null
  transfer_target_currency?: string | null
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
  recurring_id?: string | null
  category?: Pick<FamilyCategory, 'id' | 'name' | 'kind' | 'parent_id' | 'icon'> | null
  categoryPath?: string | null
}

export type NetWorthTrendTransaction = Pick<
  FamilyTransaction,
  'kind' | 'amount' | 'currency' | 'occurred_on' | 'occurred_at'
>

export type TransferDisplayAmounts = {
  sourceAmount: number
  sourceCurrency: string
  targetAmount: number
  targetCurrency: string
  isCrossCurrency: boolean
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
  query?: string
  startDate?: string
  endDate?: string
}

export type FamilyMerchant = {
  id: string
  name: string
  group_id: string | null
  last_used_at: string
  is_archived: boolean
  created_at: string
}

export type FamilyMerchantGroup = {
  id: string
  name: string
  sort_order: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type MerchantPickerGroup = {
  id: string
  label: string
  merchants: FamilyMerchant[]
  virtual: boolean
}

export const UNASSIGNED_MERCHANT_GROUP_ID = '__unassigned__'

async function probeTransactionColumn(column: string): Promise<boolean> {
  const supabase = createAdminClient()
  if (!supabase) return false
  const { error } = await supabase.from('family_transactions').select(column).limit(1)
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') return false
    console.error(`[family-transactions] probe column ${column} failed:`, error)
    return false
  }
  return true
}

export async function supportsTransactionRecurringColumn(): Promise<boolean> {
  if (transactionRecurringColumnSupported !== null) return transactionRecurringColumnSupported
  transactionRecurringColumnSupported = await probeTransactionColumn('recurring_id')
  return transactionRecurringColumnSupported
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

export function getTransferDisplayAmounts(
  transaction: Pick<
    FamilyTransaction,
    'amount' | 'currency' | 'transfer_target_amount' | 'transfer_target_currency'
  >,
): TransferDisplayAmounts {
  const sourceAmount = Number(transaction.amount) || 0
  const sourceCurrency = (transaction.currency || 'TWD').toUpperCase()
  const targetAmount = Number(transaction.transfer_target_amount ?? transaction.amount) || sourceAmount
  const targetCurrency = (transaction.transfer_target_currency || sourceCurrency).toUpperCase()

  return {
    sourceAmount,
    sourceCurrency,
    targetAmount,
    targetCurrency,
    isCrossCurrency: sourceCurrency !== targetCurrency || Math.abs(sourceAmount - targetAmount) > 0.009,
  }
}

export function getTransferAmountForAccount(
  transaction: Pick<
    FamilyTransaction,
    'kind' | 'amount' | 'currency' | 'transfer_target_amount' | 'transfer_target_currency' | 'account_id' | 'to_account_id'
  >,
  accountId: string,
) {
  if (transaction.kind !== 'transfer') return null

  const transfer = getTransferDisplayAmounts(transaction)

  if (transaction.account_id === accountId) {
    return {
      role: 'source' as const,
      amount: transfer.sourceAmount,
      currency: transfer.sourceCurrency,
      counterpartAmount: transfer.targetAmount,
      counterpartCurrency: transfer.targetCurrency,
    }
  }

  if (transaction.to_account_id === accountId) {
    return {
      role: 'destination' as const,
      amount: transfer.targetAmount,
      currency: transfer.targetCurrency,
      counterpartAmount: transfer.sourceAmount,
      counterpartCurrency: transfer.sourceCurrency,
    }
  }

  return null
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
    .select('id, name, group_id, last_used_at, is_archived, created_at')
    .eq('is_archived', false)
    .order('last_used_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message.includes('family_merchants')) return []
    throw new Error(error.message)
  }

  return (data ?? []) as FamilyMerchant[]
}

export async function getAllMerchants(): Promise<FamilyMerchant[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('family_merchants')
    .select('id, name, group_id, last_used_at, is_archived, created_at')
    .eq('is_archived', false)
    .order('last_used_at', { ascending: false })

  if (error) {
    if (error.message.includes('family_merchants')) return []
    throw new Error(error.message)
  }

  return (data ?? []) as FamilyMerchant[]
}

export async function getMerchantGroups(): Promise<FamilyMerchantGroup[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('family_merchant_groups')
    .select('id, name, sort_order, is_archived, created_at, updated_at')
    .eq('is_archived', false)
    .order('sort_order')
    .order('name')

  if (error) {
    if (error.message.includes('family_merchant_groups')) return []
    throw new Error(error.message)
  }

  return (data ?? []) as FamilyMerchantGroup[]
}

export function buildMerchantPickerGroups(
  merchants: FamilyMerchant[],
  groups: FamilyMerchantGroup[],
): MerchantPickerGroup[] {
  const compareMerchantsByRecent = (a: FamilyMerchant, b: FamilyMerchant) => {
    if (a.last_used_at !== b.last_used_at) {
      return b.last_used_at.localeCompare(a.last_used_at)
    }

    return a.name.localeCompare(b.name, 'zh-TW')
  }
  const recentMerchants = [...merchants].sort(compareMerchantsByRecent).slice(0, 5)
  const allMerchants = [...merchants].sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
  const unassignedMerchants = allMerchants
    .filter((merchant) => !merchant.group_id)
    .sort(compareMerchantsByRecent)

  const byGroupId = new Map<string, FamilyMerchant[]>()
  for (const merchant of allMerchants) {
    if (!merchant.group_id) continue
    const existing = byGroupId.get(merchant.group_id) ?? []
    existing.push(merchant)
    byGroupId.set(merchant.group_id, existing)
  }

  return [
    {
      id: 'recent',
      label: '最近使用',
      merchants: recentMerchants,
      virtual: true,
    },
    ...(unassignedMerchants.length > 0
      ? [{
          id: UNASSIGNED_MERCHANT_GROUP_ID,
          label: '未分類',
          merchants: unassignedMerchants,
          virtual: true,
        }]
      : []),
    ...groups.map<MerchantPickerGroup>((group) => ({
      id: group.id,
      label: group.name,
      merchants: (byGroupId.get(group.id) ?? []).slice().sort(compareMerchantsByRecent),
      virtual: false,
    })),
  ]
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

export type RecentAccountIdsByKind = Record<TransactionKind, string[]>

export async function getRecentAccountIdsByKind(options?: {
  days?: number
  limit?: number
}): Promise<RecentAccountIdsByKind> {
  const empty: RecentAccountIdsByKind = { expense: [], income: [], transfer: [] }
  const supabase = createAdminClient()
  if (!supabase) return empty

  const days = options?.days ?? 30
  const limit = options?.limit ?? 10
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('family_transactions')
    .select('kind, account_id, to_account_id')
    .gte('occurred_at', since)

  if (error) {
    console.error('[getRecentAccountIdsByKind] failed', error)
    return empty
  }

  const tally: Record<TransactionKind, Map<string, number>> = {
    expense: new Map(),
    income: new Map(),
    transfer: new Map(),
  }

  for (const row of data ?? []) {
    const kind = row.kind as TransactionKind
    if (!tally[kind]) continue
    const bump = (id: string | null) => {
      if (!id) return
      tally[kind].set(id, (tally[kind].get(id) ?? 0) + 1)
    }
    bump(row.account_id)
    if (kind === 'transfer') bump(row.to_account_id)
  }

  const pickTop = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)

  return {
    expense: pickTop(tally.expense),
    income: pickTop(tally.income),
    transfer: pickTop(tally.transfer),
  }
}

async function attachCategoryPaths(transactions: FamilyTransaction[]): Promise<FamilyTransaction[]> {
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

export async function getTransactionById(id: string): Promise<FamilyTransaction | null> {
  const supabase = createAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('family_transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const [transaction] = await attachCategoryPaths([data as FamilyTransaction])
  return transaction ?? null
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

  if (params.startDate && params.endDate) {
    query = query
      .gte('occurred_on', params.startDate)
      .lte('occurred_on', params.endDate)
  } else if (!params.query && params.year && params.month) {
    const y = params.year
    const m = String(params.month).padStart(2, '0')
    const lastDay = new Date(y, params.month, 0).getDate()
    query = query
      .gte('occurred_on', `${y}-${m}-01`)
      .lte('occurred_on', `${y}-${m}-${lastDay}`)
  } else if (!params.query && params.year) {
    const y = params.year
    query = query
      .gte('occurred_on', `${y}-01-01`)
      .lte('occurred_on', `${y}-12-31`)
  }

  if (params.accountId) {
    query = query.or(`account_id.eq.${params.accountId},to_account_id.eq.${params.accountId}`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let transactions = await attachCategoryPaths((data ?? []) as FamilyTransaction[])

  if (params.query) {
    const q = params.query.trim().toLocaleLowerCase('zh-TW')
    if (q) {
      transactions = transactions.filter((tx) => {
        const haystack = [tx.title, tx.merchant, tx.note, tx.categoryPath]
          .map((value) => String(value ?? '').toLocaleLowerCase('zh-TW'))
          .join('|')
        return haystack.includes(q)
      })
    }
  }

  return transactions
}

export async function getNetWorthTrendTransactions(): Promise<NetWorthTrendTransaction[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const pageSize = 1000
  const readPage = async (from: number) => {
    const to = from + pageSize - 1
    return supabase
      .from('family_transactions')
      .select('kind, amount, currency, occurred_on, occurred_at', { count: 'exact' })
      .neq('kind', 'transfer')
      .order('occurred_on', { ascending: true })
      .range(from, to)
  }

  const firstPage = await readPage(0)
  if (firstPage.error) throw new Error(firstPage.error.message)

  const firstPageTransactions = (firstPage.data ?? []).map((transaction) => ({
    kind: transaction.kind as TransactionKind,
    amount: Number(transaction.amount) || 0,
    currency: transaction.currency || 'TWD',
    occurred_on: transaction.occurred_on as string,
    occurred_at: transaction.occurred_at ?? undefined,
  }))

  const count = firstPage.count ?? firstPageTransactions.length
  if (count <= pageSize) {
    return firstPageTransactions
  }

  const pageCount = Math.ceil(count / pageSize)
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, page) => readPage((page + 1) * pageSize)),
  )

  return [
    ...firstPageTransactions,
    ...remainingPages.flatMap((page) => {
      if (page.error) throw new Error(page.error.message)

      return (page.data ?? []).map((transaction) => ({
        kind: transaction.kind as TransactionKind,
        amount: Number(transaction.amount) || 0,
        currency: transaction.currency || 'TWD',
        occurred_on: transaction.occurred_on as string,
        occurred_at: transaction.occurred_at ?? undefined,
      }))
    }),
  ]
}
