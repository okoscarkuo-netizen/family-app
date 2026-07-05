import { notFound } from 'next/navigation'
import { getActiveAccountsForForm } from '@/lib/accounts-db'
import { getAllCategories, getAllMerchants, getCategoryPath, type FamilyCategory } from '@/lib/family-transactions'
import { getRecurringTransactionById } from '@/lib/recurring-db'
import { BottomNav } from '@/components/BottomNav'
import { RecurringEditor } from '../_components/RecurringEditor'

function buildCategoryOptions(categories: FamilyCategory[]) {
  return categories
    .filter((category) => !category.is_archived)
    .map((category) => ({
      id: category.id,
      kind: category.kind,
      label: getCategoryPath(category.id, categories) ?? category.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-TW'))
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function RecurringEditPage({ params }: PageProps) {
  const { id } = await params
  const recurring = await getRecurringTransactionById(decodeURIComponent(id))
  if (!recurring) notFound()

  const [accounts, categories, merchants] = await Promise.all([
    getActiveAccountsForForm({ includeHidden: true }),
    getAllCategories(),
    getAllMerchants(),
  ])

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
            <div className="flex h-[4.5rem] items-center px-5">
              <h1 className="text-[1.35rem] font-semibold tracking-normal text-[#202124]">編輯定期交易</h1>
            </div>
          </header>
          <RecurringEditor
            recurring={recurring}
            accounts={accounts}
            categories={buildCategoryOptions(categories)}
            merchants={merchants.map((merchant) => ({ id: merchant.id, name: merchant.name }))}
          />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
