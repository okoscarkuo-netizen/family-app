import { getAccounts } from '@/lib/accounts-db'
import { AccountList } from './_components/AccountList'
import { BottomNav } from '@/components/BottomNav'

export default async function AccountsPage() {
  const accounts = await getAccounts()

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <AccountList accounts={accounts} />
      <BottomNav />
    </main>
  )
}
