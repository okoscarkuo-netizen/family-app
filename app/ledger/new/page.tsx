import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllCategories } from '@/lib/family-transactions'
import { TransactionForm } from '@/app/ledger/_components/TransactionForm'
import type { FamilyAccount } from '@/lib/finance/types'

async function getActiveAccounts(): Promise<Pick<FamilyAccount, 'id' | 'name' | 'currency'>[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('family_accounts')
    .select('id, name, currency')
    .eq('is_archived', false)
    .order('sort_order')
  return (data ?? []) as Pick<FamilyAccount, 'id' | 'name' | 'currency'>[]
}

export default async function NewTransactionPage() {
  const [accounts, categories] = await Promise.all([
    getActiveAccounts(),
    getAllCategories(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/ledger" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 返回
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">新增記錄</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <TransactionForm accounts={accounts} categories={categories} />
        </div>
      </div>
    </div>
  )
}
