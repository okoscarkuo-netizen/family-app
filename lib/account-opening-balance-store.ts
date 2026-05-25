import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ensureDefaultHouseholdId } from '@/lib/household'

const ACCOUNT_OPENING_BALANCES_KEY = 'account_opening_balances'
const ACCOUNT_FAVORITE_IDS_KEY = 'favorite_account_ids'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

export type AccountOpeningBalanceMap = Record<string, number>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? roundAmount(amount) : null
}

export function normalizeAccountOpeningBalanceMap(value: unknown): AccountOpeningBalanceMap {
  if (!isRecord(value)) return {}

  return Object.entries(value).reduce<AccountOpeningBalanceMap>((acc, [accountId, amount]) => {
    const normalized = normalizeAmount(amount)
    if (normalized !== null) {
      acc[accountId] = normalized
    }
    return acc
  }, {})
}

export function mergeDashboardStatePreservingExtras(
  existingState: unknown,
  nextKnownState: Record<string, unknown>,
) {
  const merged = isRecord(existingState) ? { ...existingState } : {}

  for (const [key, value] of Object.entries(nextKnownState)) {
    merged[key] = value
  }

  return merged
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean),
    ),
  )
}

async function getAuthenticatedUser() {
  const authClient = await createClient()
  const { data, error } = await authClient.auth.getUser()

  if (error) throw new Error(error.message)
  return data.user ?? null
}

export async function resolveCurrentHouseholdId() {
  try {
    const supabase = createAdminClient()
    if (!supabase) return null

    const user = await getAuthenticatedUser()
    if (user) {
      return ensureDefaultHouseholdId(supabase, user)
    }

    const { data, error } = await supabase
      .from('households')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data?.id ?? null
  } catch {
    return null
  }
}

async function readHouseholdDashboardState(supabase: AdminClient, householdId: string) {
  const { data, error } = await supabase
    .from('household_dashboard_state')
    .select('state')
    .eq('household_id', householdId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return isRecord(data?.state) ? data.state : {}
}

async function writeHouseholdDashboardState(
  supabase: AdminClient,
  householdId: string,
  state: Record<string, unknown>,
  updatedBy?: string | null,
) {
  const payload: Record<string, unknown> = {
    household_id: householdId,
    state,
  }

  if (updatedBy) {
    payload.updated_by = updatedBy
  }

  const { error } = await supabase.from('household_dashboard_state').upsert(payload, {
    onConflict: 'household_id',
  })

  if (error) throw new Error(error.message)
}

export async function getAccountOpeningBalancesForHousehold(
  supabase: AdminClient,
  householdId: string,
): Promise<AccountOpeningBalanceMap> {
  try {
    const state = await readHouseholdDashboardState(supabase, householdId)
    return normalizeAccountOpeningBalanceMap(state[ACCOUNT_OPENING_BALANCES_KEY])
  } catch (error) {
    console.error('[account-opening-balance-store] read error:', error)
    return {}
  }
}

export async function getFavoriteAccountIdsForHousehold(
  supabase: AdminClient,
  householdId: string,
): Promise<Set<string>> {
  try {
    const state = await readHouseholdDashboardState(supabase, householdId)
    return new Set(normalizeStringArray(state[ACCOUNT_FAVORITE_IDS_KEY]))
  } catch (error) {
    console.error('[account-opening-balance-store] favorite read error:', error)
    return new Set()
  }
}

export async function setFavoriteAccountForHousehold(
  supabase: AdminClient,
  householdId: string,
  accountId: string,
  favorite: boolean,
  updatedBy?: string | null,
) {
  const currentState = await readHouseholdDashboardState(supabase, householdId)
  const favoriteIds = new Set(normalizeStringArray(currentState[ACCOUNT_FAVORITE_IDS_KEY]))

  if (favorite) {
    favoriteIds.add(accountId)
  } else {
    favoriteIds.delete(accountId)
  }

  const nextState = {
    ...currentState,
    [ACCOUNT_FAVORITE_IDS_KEY]: Array.from(favoriteIds),
  }

  await writeHouseholdDashboardState(supabase, householdId, nextState, updatedBy)
}

export async function setAccountOpeningBalancesForHousehold(
  supabase: AdminClient,
  householdId: string,
  openingBalances: AccountOpeningBalanceMap,
  updatedBy?: string | null,
) {
  const currentState = await readHouseholdDashboardState(supabase, householdId)
  const nextState = {
    ...currentState,
    [ACCOUNT_OPENING_BALANCES_KEY]: normalizeAccountOpeningBalanceMap({
      ...normalizeAccountOpeningBalanceMap(currentState[ACCOUNT_OPENING_BALANCES_KEY]),
      ...openingBalances,
    }),
  }

  await writeHouseholdDashboardState(supabase, householdId, nextState, updatedBy)
}
