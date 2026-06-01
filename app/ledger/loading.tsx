import { BottomNav } from '@/components/BottomNav'

function TransactionSkeletonRow() {
  return (
    <div className="flex items-start gap-2.5 px-4 py-2">
      <div className="h-10 w-10 shrink-0 rounded-full bg-[#f0f0ed] animate-pulse" />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="h-4 w-36 rounded-full bg-[#ededeb] animate-pulse" />
        <div className="mt-2 h-3 w-44 rounded-full bg-[#f3f3f1] animate-pulse" />
      </div>
      <div className="h-4 w-20 shrink-0 rounded-full bg-[#ededeb] animate-pulse" />
    </div>
  )
}

export default function Loading() {
  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <header className="border-b border-[#eeeeec] bg-[#f6f4ef] px-4 pb-2 pt-[calc(0.35rem+env(safe-area-inset-top))]">
            <div className="rounded-[1.8rem] border border-[#ebe4d7] bg-[linear-gradient(180deg,#fffdf8_0%,#fbf7ef_100%)] px-3 py-2.5 shadow-[0_16px_44px_rgba(15,23,42,0.10)]">
              <div className="flex items-center justify-between gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-white/80 animate-pulse" />
                <div className="h-7 w-40 rounded-full bg-white/80 animate-pulse" />
                <div className="h-10 w-10 shrink-0 rounded-full bg-white/80 animate-pulse" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-9 w-9 shrink-0 rounded-full bg-white/80 animate-pulse" />
                <div className="h-14 flex-1 rounded-[1.35rem] bg-white/80 animate-pulse" />
                <div className="h-9 w-9 shrink-0 rounded-full bg-white/80 animate-pulse" />
              </div>
              <div className="mt-2 h-8 rounded-full bg-white/80 animate-pulse" />
            </div>
          </header>

          <div className="flex-1 overflow-hidden">
            <section className="border-t-2 border-[#f4f4f2] bg-white first:border-t-0">
              <div className="flex items-start justify-between gap-2.5 px-4 pb-1 pt-3">
                <div className="h-5 w-24 rounded-full bg-[#ededeb] animate-pulse" />
                <div className="h-4 w-32 rounded-full bg-[#f3f3f1] animate-pulse" />
              </div>
              <TransactionSkeletonRow />
              <TransactionSkeletonRow />
              <TransactionSkeletonRow />
            </section>
            <section className="border-t-2 border-[#f4f4f2] bg-white">
              <div className="flex items-start justify-between gap-2.5 px-4 pb-1 pt-3">
                <div className="h-5 w-20 rounded-full bg-[#ededeb] animate-pulse" />
                <div className="h-4 w-28 rounded-full bg-[#f3f3f1] animate-pulse" />
              </div>
              <TransactionSkeletonRow />
              <TransactionSkeletonRow />
            </section>
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
