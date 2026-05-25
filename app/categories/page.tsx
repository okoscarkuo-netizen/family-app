import { getAllCategories } from '@/lib/family-transactions'
import { BottomNav } from '@/components/BottomNav'
import { CategoryManager } from './_components/CategoryManager'

export default async function CategoriesPage() {
  const categories = await getAllCategories()

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <CategoryManager initialCategories={categories} />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
