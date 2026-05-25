import { BottomNav } from '@/components/BottomNav'
import { getAllMerchants, getMerchantGroups } from '@/lib/family-transactions'
import { MerchantManager } from './_components/MerchantManager'

export default async function MerchantsPage() {
  const [merchants, groups] = await Promise.all([getAllMerchants(), getMerchantGroups()])

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <MerchantManager initialMerchants={merchants} initialGroups={groups} />
        </section>
      </main>
      <BottomNav />
    </>
  )
}
