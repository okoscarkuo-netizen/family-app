import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getActiveAccountsForForm } from '@/lib/accounts-db'
import {
  getAllCategories,
  getAllMerchants,
  getMerchantGroups,
  getRecentAccountIdsByKind,
  getTransactionById,
} from '@/lib/family-transactions'
import { getTwdRateTable } from '@/lib/exchange-rates'
import { getMaintenanceItemsForForm } from '@/lib/reminders-db'
import { TransactionForm } from '@/app/ledger/_components/TransactionForm'
import { BottomNav } from '@/components/BottomNav'
import { shellBackgroundClass } from '@/components/PageShell'

function ledgerHrefForDate(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})/)
  if (!match) return '/ledger'
  return `/ledger?year=${match[1]}&month=${Number(match[2])}`
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function EditTransactionPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { from } = await searchParams
  const transaction = await getTransactionById(decodeURIComponent(id))
  if (!transaction) notFound()

  const [accounts, maintenanceItems, categories, merchants, merchantGroups, rateTable, recentAccountIdsByKind] = await Promise.all([
    getActiveAccountsForForm({ includeHidden: true }),
    getMaintenanceItemsForForm(),
    getAllCategories(),
    getAllMerchants(),
    getMerchantGroups(),
    getTwdRateTable(),
    getRecentAccountIdsByKind(),
  ])

  return (
    <>
      <main className={shellBackgroundClass}>
        <section className="mx-auto min-h-screen w-full max-w-md">
          <div className="border-b border-[#ece4d8] bg-[#faf7f0]/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <div className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] items-center">
              <Link
                href={ledgerHrefForDate(transaction.occurred_on)}
                className="text-left text-sm font-black text-slate-500"
              >
                返回
              </Link>
              <h1 className="truncate text-center text-lg font-black text-slate-950">修改流水</h1>
              <div aria-hidden="true" />
            </div>
          </div>

          <TransactionForm
            accounts={accounts}
            maintenanceItems={maintenanceItems}
            categories={categories}
            merchants={merchants}
            merchantGroups={merchantGroups}
            initialPreset={null}
            rateTable={rateTable}
            mode="edit"
            transaction={transaction}
            returnUrl={from}
            recentAccountIdsByKind={recentAccountIdsByKind}
          />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
