import Link from 'next/link'
import { Suspense } from 'react'
import { getTransactions } from '@/lib/family-transactions'
import { createAdminClient } from '@/lib/supabase/admin'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { TransactionFilters } from '@/app/ledger/_components/TransactionFilters'
import { BottomNav } from '@/components/BottomNav'
import type { FamilyAccount } from '@/lib/finance/types'

async function getActiveAccounts(): Promise<Pick<FamilyAccount, 'id' | 'name'>[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('family_accounts')
    .select('id, name')
    .eq('is_archived', false)
    .order('sort_order')
  return (data ?? []) as Pick<FamilyAccount, 'id' | 'name'>[]
}

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string; accountId?: string }>
}

export default async function LedgerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()), 10)
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10)
  const accountId = params.accountId || undefined

  const [transactions, accounts] = await Promise.all([
    getTransactions({ year, month, accountId }),
    getActiveAccounts(),
  ])

  return (
    <main className="min-h-screen bg-[#faf7f0] pb-28">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-lg font-black text-slate-950">帳本</h1>
          <Link
            href="/ledger/new"
            className="rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_#111827] hover:bg-[#e92b87]"
          >
            ＋ 新增
          </Link>
        </div>

        <div className="mb-4">
          <Suspense>
            <TransactionFilters
              accounts={accounts}
              currentYear={year}
              currentMonth={month}
            />
          </Suspense>
        </div>

        <TransactionList transactions={transactions} />
      </div>
      <BottomNav />
    </main>
  )
}
