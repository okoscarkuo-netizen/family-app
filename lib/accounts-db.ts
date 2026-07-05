import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_cache } from 'next/cache'
import { accountFromRow, accountToRow, initialAccounts } from '@/lib/accounts'
import type { AccountRow } from '@/lib/accounts'
import type { FamilyAccount } from '@/lib/finance/types'
import {
  getFavoriteAccountIdsForHousehold,
  getAccountOpeningBalancesForHousehold,
  resolveCurrentHouseholdId,
  setAccountOpeningBalancesForHousehold,
} from '@/lib/account-opening-balance-store'
import { DATA_CACHE_REVALIDATE_SECONDS, DATA_CACHE_TAGS } from '@/lib/data-cache'

let openingBalanceColumnSupported: boolean | null = null
let remarkColumnSupported: boolean | null = null
let favoriteColumnSupported: boolean | null = null
let balanceDateColumnSupported: boolean | null = null
const LEDGER_DELTA_PAGE_SIZE = 1000

type FormAccountOption = Pick<
  FamilyAccount,
  'id' | 'name' | 'currency' | 'kind' | 'balance' | 'owner' | 'shared' | 'type' | 'favorite'
>

async function probeColumn(column: string): Promise<boolean> {
  const supabase = createAdminClient()
  if (!supabase) return false
  const { error } = await supabase.from('family_accounts').select(column).limit(1)
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') return false
    throw new Error(error.message)
  }
  return true
}

export async function supportsOpeningBalanceColumn(): Promise<boolean> {
  if (openingBalanceColumnSupported !== null) return openingBalanceColumnSupported
  openingBalanceColumnSupported = await probeColumn('opening_balance')
  return openingBalanceColumnSupported
}

export async function supportsRemarkColumn(): Promise<boolean> {
  if (remarkColumnSupported !== null) return remarkColumnSupported
  remarkColumnSupported = await probeColumn('remark')
  return remarkColumnSupported
}

export async function supportsFavoriteColumn(): Promise<boolean> {
  if (favoriteColumnSupported !== null) return favoriteColumnSupported
  favoriteColumnSupported = await probeColumn('favorite')
  return favoriteColumnSupported
}

export async function supportsBalanceDateColumn(): Promise<boolean> {
  if (balanceDateColumnSupported !== null) return balanceDateColumnSupported
  balanceDateColumnSupported = await probeColumn('balance_date')
  return balanceDateColumnSupported
}

export async function getAccounts(): Promise<FamilyAccount[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const [supportsOpeningBalance, supportsFavorite] = await Promise.all([
    supportsOpeningBalanceColumn(),
    supportsFavoriteColumn(),
  ])

  let query = supabase
    .from('family_accounts')
    .select('*')
    .eq('is_archived', false)
  if (supportsFavorite) {
    query = query.order('favorite', { ascending: false })
  }
  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[accounts-db] getAccounts error:', error)
    return []
  }

  // Seed from initialAccounts on first use (mirrors /api/accounts GET behaviour)
  if (!data?.length) {
    const rows = initialAccounts.map((acc, i) =>
      accountToRow(acc, i, {
        includeOpeningBalance: supportsOpeningBalance,
        includeFavorite: supportsFavorite,
      }),
    )
    await supabase.from('family_accounts').upsert(rows, { onConflict: 'id' })

    if (!supportsOpeningBalance) {
      const householdId = await resolveCurrentHouseholdId()
      if (householdId) {
        const openingBalances = Object.fromEntries(
          initialAccounts.map((account) => [account.id, account.balance]),
        )
        try {
          await setAccountOpeningBalancesForHousehold(supabase, householdId, openingBalances)
        } catch (error) {
          console.error('[accounts-db] seed opening balance sync error:', error)
        }
      }
    }

    return initialAccounts
  }

  if (supportsOpeningBalance) {
    return data.map(row => accountFromRow(row as AccountRow))
  }

  const householdId = await resolveCurrentHouseholdId()
  const openingBalances: Record<string, number> = householdId
    ? await getAccountOpeningBalancesForHousehold(supabase, householdId)
    : {}
  const favoriteIds = householdId
    ? await getFavoriteAccountIdsForHousehold(supabase, householdId)
    : new Set<string>()

  return data.map((row) =>
    accountFromRow(row as AccountRow, openingBalances[row.id], favoriteIds.has(row.id))
  )
}

export async function getAccountById(id: string): Promise<FamilyAccount | null> {
  const supabase = createAdminClient()
  if (!supabase) return null
  const supportsOpeningBalance = await supportsOpeningBalanceColumn()

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

  const householdId = await resolveCurrentHouseholdId()
  const openingBalances: Record<string, number> = householdId
    ? await getAccountOpeningBalancesForHousehold(supabase, householdId)
    : {}
  const favoriteIds = householdId
    ? await getFavoriteAccountIdsForHousehold(supabase, householdId)
    : new Set<string>()

  return accountFromRow(
    data as AccountRow,
    supportsOpeningBalance ? undefined : openingBalances[id],
    favoriteIds.has(id),
  )
}

export async function getAccountLedgerDelta(id: string): Promise<number> {
  const supabase = createAdminClient()
  if (!supabase) return 0

  let total = 0
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('family_ledger_entries')
      .select('amount_delta')
      .eq('account_id', id)
      .range(from, from + LEDGER_DELTA_PAGE_SIZE - 1)

    if (error) {
      console.error('[accounts-db] getAccountLedgerDelta error:', error)
      return 0
    }

    for (const row of data ?? []) {
      const amount = Number(row.amount_delta)
      if (Number.isFinite(amount)) total += amount
    }

    if (!data || data.length < LEDGER_DELTA_PAGE_SIZE) break
    from += LEDGER_DELTA_PAGE_SIZE
  }

  return Math.round(total * 100) / 100
}

export async function getAllAccountLedgerDeltas(): Promise<Record<string, number>> {
  const supabase = createAdminClient()
  if (!supabase) return {}

  const result: Record<string, number> = {}
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('family_ledger_entries')
      .select('account_id, amount_delta')
      .range(from, from + LEDGER_DELTA_PAGE_SIZE - 1)

    if (error) {
      console.error('[accounts-db] getAllAccountLedgerDeltas error:', error)
      return {}
    }

    for (const row of data ?? []) {
      if (!row.account_id) continue
      const amount = Number(row.amount_delta)
      if (Number.isFinite(amount)) {
        result[row.account_id] = Math.round(((result[row.account_id] ?? 0) + amount) * 100) / 100
      }
    }

    if (!data || data.length < LEDGER_DELTA_PAGE_SIZE) break
    from += LEDGER_DELTA_PAGE_SIZE
  }

  return result
}

const getActiveAccountsForFormCached = unstable_cache(
  async (): Promise<FamilyAccount[]> => {
    const supabase = createAdminClient()
    if (!supabase) return []

    const supportsFavorite = await supportsFavoriteColumn()
    const selectColumns = [
      'id',
      'name',
      'currency',
      'kind',
      'balance',
      'owner',
      'shared',
      'type',
      supportsFavorite ? 'favorite' : null,
      'hidden',
    ]
      .filter(Boolean)
      .join(', ')

    const { data, error } = await supabase
      .from('family_accounts')
      .select(selectColumns)
      .eq('is_archived', false)
      .order('sort_order')

    if (error) {
      console.error('[accounts-db] getActiveAccountsForForm error:', error)
      return []
    }

    return (data ?? []).map((row) => accountFromRow(row as unknown as AccountRow))
  },
  ['active-accounts-for-form'],
  {
    revalidate: DATA_CACHE_REVALIDATE_SECONDS,
    tags: [DATA_CACHE_TAGS.accounts],
  },
)

export async function getActiveAccountsForForm(options?: {
  includeHidden?: boolean
}): Promise<FormAccountOption[]> {
  const includeHidden = options?.includeHidden ?? false
  const accounts = await getActiveAccountsForFormCached()

  return accounts
    .filter((account) => includeHidden || !account.hidden)
    .map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      kind: account.kind,
      balance: account.balance,
      owner: account.owner,
      shared: account.shared,
      type: account.type,
      favorite: account.favorite,
    }))
}
