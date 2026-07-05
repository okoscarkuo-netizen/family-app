import { notFound } from 'next/navigation'
import { getActiveAccountsForForm } from '@/lib/accounts-db'
import {
  getAllMerchants,
  getTransactionById,
  supportsTransactionRecurringColumn,
} from '@/lib/family-transactions'
import { getRecurringTransactionById } from '@/lib/recurring-db'
import { TransactionDetail } from '@/app/ledger/_components/TransactionDetail'

function ledgerHrefForDate(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})/)
  if (!match) return '/ledger'
  return `/ledger?year=${match[1]}&month=${Number(match[2])}`
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function TransactionDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, { from }] = await Promise.all([params, searchParams])
  const transaction = await getTransactionById(decodeURIComponent(id))
  if (!transaction) notFound()

  const [accounts, merchants, recurringSupported] = await Promise.all([
    getActiveAccountsForForm({ includeHidden: true }),
    getAllMerchants(),
    supportsTransactionRecurringColumn(),
  ])
  const recurring = recurringSupported && transaction.recurring_id
    ? await getRecurringTransactionById(transaction.recurring_id)
    : null
  const returnUrl = from || ledgerHrefForDate(transaction.occurred_on)

  return (
    <TransactionDetail
      transaction={transaction}
      accounts={accounts}
      merchants={merchants}
      recurringFrequency={recurring?.frequency ?? null}
      recurringSupported={recurringSupported}
      returnUrl={returnUrl}
    />
  )
}
