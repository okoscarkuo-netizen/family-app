import { createAdminClient } from '@/lib/supabase/admin'
import { accountFromRow, accountToRow, initialAccounts } from '@/lib/accounts'
import type { AccountRow } from '@/lib/accounts'
import type { FamilyAccount } from '@/lib/finance/types'

export async function getAccounts(): Promise<FamilyAccount[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('family_accounts')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[accounts-db] getAccounts error:', error)
    return []
  }

  // Seed from initialAccounts on first use (mirrors /api/accounts GET behaviour)
  if (!data?.length) {
    const rows = initialAccounts.map((acc, i) => accountToRow(acc, i))
    await supabase.from('family_accounts').upsert(rows, { onConflict: 'id' })
    return initialAccounts
  }

  return data.map(row => accountFromRow(row as AccountRow))
}

export async function getAccountById(id: string): Promise<FamilyAccount | null> {
  const supabase = createAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('family_accounts')
    .select('*')
    .eq('id', id)
    .eq('is_archived', false)
    .single()

  if (error || !data) {
    if (error) console.error('[accounts-db] getAccountById error:', error)
    return null
  }
  return accountFromRow(data as AccountRow)
}
