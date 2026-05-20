import Link from 'next/link'
import { Suspense } from 'react'
import { getTransactions } from '@/lib/family-transactions'
import { createAdminClient } from '@/lib/supabase/admin'
import { TransactionList } from '@/app/ledger/_components/TransactionList'
import { TransactionFilters } from '@/app/ledger/_components/TransactionFilters'
import { BottomNav } from '@/components/BottomNav'
import { PageShell, primaryButtonClass } from '@/components/PageShell'
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
    <PageShell
      title="流水"
      eyebrow="收支紀錄"
      description="依月份、帳戶篩選，查看家庭流水的每一筆變動。"
      action={
        <Link href="/ledger/new" className={primaryButtonClass}>
          ＋ 新增
        </Link>
      }
      contentClassName="space-y-4"
    >
      <Suspense>
        <TransactionFilters
          accounts={accounts}
          currentYear={year}
          currentMonth={month}
        />
      </Suspense>
      <TransactionList transactions={transactions} />
      <BottomNav />
    </PageShell>
  )
}
