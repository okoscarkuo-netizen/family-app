import { createAdminClient } from '@/lib/supabase/admin'

export type TransactionKind = 'income' | 'expense' | 'transfer'
export type TransactionOwner = '我' | '老婆' | '共同'

export type FamilyCategory = {
  id: string
  name: string
  kind: TransactionKind
  icon: string | null
  color: string | null
  sort_order: number
  is_archived: boolean
}

export type FamilyTransaction = {
  id: string
  kind: TransactionKind
  title: string
  amount: number
  currency: string
  category_id: string | null
  account_id: string | null
  to_account_id: string | null
  owner: TransactionOwner
  merchant: string | null
  occurred_on: string
  note: string | null
  created_at: string
  category?: Pick<FamilyCategory, 'id' | 'name' | 'kind'> | null
}

export type GetTransactionsParams = {
  year?: number
  month?: number
  accountId?: string
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

export async function getTransactions(params: GetTransactionsParams = {}): Promise<FamilyTransaction[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from('family_transactions')
    .select('*, category:family_categories(id, name, kind)')
    .order('occurred_on', { ascending: false })
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
  return (data ?? []) as FamilyTransaction[]
}
