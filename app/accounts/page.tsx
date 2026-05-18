import { getAccounts } from '@/lib/accounts-db'
import { AccountList } from './_components/AccountList'

export default async function AccountsPage() {
  const accounts = await getAccounts()

  return (
    <main className="min-h-screen bg-[#faf7f0] text-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-5">
          <AccountList accounts={accounts} />
        </div>
      </div>
    </main>
  )
}
