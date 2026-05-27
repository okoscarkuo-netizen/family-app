import { createAdminClient } from '@/lib/supabase/admin'
import {
  getAllCategories,
  getAllMerchants,
  getLatestTransactionPreset,
  getMerchantGroups,
} from '@/lib/family-transactions'
import { getTwdRateTable } from '@/lib/exchange-rates'
import { TransactionForm } from '@/app/ledger/_components/TransactionForm'
import { BottomNav } from '@/components/BottomNav'
import { shellBackgroundClass } from '@/components/PageShell'
import type { FamilyAccount } from '@/lib/finance/types'

async function getActiveAccounts(): Promise<
  Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'kind' | 'balance' | 'owner' | 'shared' | 'type' | 'favorite'>[]
> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('family_accounts')
    .select('id, name, currency, kind, balance, owner, shared, type, favorite')
    .eq('is_archived', false)
    .eq('hidden', false)
    .order('sort_order')
  return (data ?? []) as Pick<
    FamilyAccount,
    'id' | 'name' | 'currency' | 'kind' | 'balance' | 'owner' | 'shared' | 'type' | 'favorite'
  >[]
}

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  const params = await searchParams
  const initialKind = params.kind === 'reminder' ? 'reminder' : undefined

  const [accounts, categories, merchants, merchantGroups, latestPreset, rateTable] = await Promise.all([
    getActiveAccounts(),
    getAllCategories(),
    getAllMerchants(),
    getMerchantGroups(),
    getLatestTransactionPreset(),
    getTwdRateTable(),
  ])

  return (
    <>
      <main className={shellBackgroundClass}>
        <section className="mx-auto min-h-screen w-full max-w-md">
          <TransactionForm
            accounts={accounts}
            categories={categories}
            merchants={merchants}
            merchantGroups={merchantGroups}
            initialPreset={latestPreset}
            rateTable={rateTable}
            initialKind={initialKind}
          />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
