import { createAdminClient } from '@/lib/supabase/admin'
import { getAllCategories, getLatestTransactionPreset } from '@/lib/family-transactions'
import { TransactionForm } from '@/app/ledger/_components/TransactionForm'
import { BottomNav } from '@/components/BottomNav'
import { shellBackgroundClass } from '@/components/PageShell'
import type { FamilyAccount } from '@/lib/finance/types'

async function getActiveAccounts(): Promise<Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'kind' | 'balance'>[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('family_accounts')
    .select('id, name, currency, kind, balance')
    .eq('is_archived', false)
    .order('sort_order')
  return (data ?? []) as Pick<FamilyAccount, 'id' | 'name' | 'currency' | 'kind' | 'balance'>[]
}

export default async function NewTransactionPage() {
  const [accounts, categories, latestPreset] = await Promise.all([
    getActiveAccounts(),
    getAllCategories(),
    getLatestTransactionPreset(),
  ])

  return (
    <>
      <main className={shellBackgroundClass}>
        <section className="mx-auto min-h-screen w-full max-w-md">
          <TransactionForm
            accounts={accounts}
            categories={categories}
            initialPreset={latestPreset}
          />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
