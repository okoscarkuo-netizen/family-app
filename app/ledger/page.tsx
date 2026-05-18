import Link from 'next/link'
import { Suspense } from 'react'
import { getTransactions } from '@/lib/family-transactions'
import { createAdminClient } from '@/lib/supabase/admin'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { TransactionFilters } from '@/app/ledger/_components/TransactionFilters'
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800">帳本</h1>
          <Link
            href="/ledger/new"
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            ＋ 新增
          </Link>
        </div>

        {/* 篩選器 */}
        <div className="mb-4">
          <Suspense>
            <TransactionFilters
              accounts={accounts}
              currentYear={year}
              currentMonth={month}
            />
          </Suspense>
        </div>

        {/* 列表 */}
        <TransactionList transactions={transactions} />
      </div>
    </div>
  )
}
