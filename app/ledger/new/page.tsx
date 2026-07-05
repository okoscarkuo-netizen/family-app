import { getActiveAccountsForForm } from '@/lib/accounts-db'
import {
  getAllCategories,
  getLatestTransactionPreset,
  getRecentAccountIdsByKind,
  getTransactionById,
} from '@/lib/family-transactions'
import { getRecurringTransactionById } from '@/lib/recurring-db'
import { TransactionForm } from '@/app/ledger/_components/TransactionForm'
import { BottomNav } from '@/components/BottomNav'

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; copyFrom?: string }>
}) {
  const params = await searchParams
  const copyTransaction = params.copyFrom
    ? await getTransactionById(decodeURIComponent(params.copyFrom))
    : null
  const copyRecurring = copyTransaction?.recurring_id
    ? await getRecurringTransactionById(copyTransaction.recurring_id)
    : null
  const initialKind = params.kind === 'reminder' ? 'reminder' : undefined

  const [accounts, categories, latestPreset, recentAccountIdsByKind] = await Promise.all([
    getActiveAccountsForForm({ includeHidden: Boolean(copyTransaction) }),
    getAllCategories(),
    getLatestTransactionPreset(),
    getRecentAccountIdsByKind(),
  ])

  return (
    <>
      <main className="min-h-screen bg-white text-slate-950">
        <section className="mx-auto min-h-screen w-full max-w-md">
          <TransactionForm
            accounts={accounts}
            maintenanceItems={[]}
            categories={categories}
            merchants={[]}
            merchantGroups={[]}
            initialPreset={latestPreset}
            rateTable={null}
            copyTransaction={copyTransaction}
            copyRecurringFrequency={copyRecurring?.frequency ?? null}
            initialKind={initialKind}
            recentAccountIdsByKind={recentAccountIdsByKind}
            deferReferenceData
          />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
