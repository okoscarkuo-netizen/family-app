import { getAccounts, getAllAccountLedgerDeltas } from '@/lib/accounts-db'
import { getTwdRateTable } from '@/lib/exchange-rates'
import { AccountList } from './_components/AccountList'
import { BottomNav } from '@/components/BottomNav'

export default async function AccountsPage() {
  const [accounts, ledgerDeltas, rateTable] = await Promise.all([
    getAccounts(),
    getAllAccountLedgerDeltas(),
    getTwdRateTable(),
  ])

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <AccountList
        accounts={accounts}
        ledgerDeltas={ledgerDeltas}
        rateSnapshot={rateTable.latest}
      />
      <BottomNav />
    </main>
  )
}
