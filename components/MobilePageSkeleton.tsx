import { BottomNav } from '@/components/BottomNav'

type MobilePageSkeletonProps = {
  title: string
  variant?: 'list' | 'manager' | 'form'
}

function PulseBlock({ className }: { className: string }) {
  return <div className={`${className} animate-pulse bg-slate-100`} />
}

function ListSkeleton() {
  return (
    <div className="space-y-5 px-4 pt-4">
      {[0, 1, 2].map((section) => (
        <section key={section}>
          <div className="mb-2 flex items-center gap-2">
            <PulseBlock className="h-5 w-16 rounded-full" />
            <PulseBlock className="h-3 w-10 rounded-full" />
          </div>
          <div className="space-y-2">
            {[0, 1].map((row) => (
              <div
                key={row}
                className="rounded-[1.25rem] border border-[#ece8e1] bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <PulseBlock className="h-4 w-36 rounded-full" />
                    <PulseBlock className="mt-2 h-3 w-44 rounded-full" />
                  </div>
                  <PulseBlock className="h-8 w-8 shrink-0 rounded-full" />
                </div>
                <PulseBlock className="mt-3 h-3 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ManagerSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-4">
      <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <PulseBlock className="h-10 w-full rounded-full" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PulseBlock className="h-9 rounded-full" />
          <PulseBlock className="h-9 rounded-full" />
        </div>
      </section>
      {[0, 1, 2, 3].map((row) => (
        <section
          key={row}
          className="rounded-[1.2rem] border border-[#ece4d8] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <PulseBlock className="h-4 w-32 rounded-full" />
              <PulseBlock className="mt-2 h-3 w-44 rounded-full" />
            </div>
            <PulseBlock className="h-8 w-16 shrink-0 rounded-full" />
          </div>
        </section>
      ))}
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-32">
      <div className="border-b border-[#eeeeec] bg-[#f6f4ef] px-4 pb-3 pt-[calc(0.45rem+env(safe-area-inset-top))]">
        <div className="rounded-[1.8rem] border border-[#ebe4d7] bg-[linear-gradient(180deg,#fffdf8_0%,#fbf7ef_100%)] px-3 py-3 shadow-[0_16px_44px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between gap-3">
            <PulseBlock className="h-10 w-10 shrink-0 rounded-full bg-white/80" />
            <PulseBlock className="h-8 w-32 rounded-full bg-white/80" />
            <PulseBlock className="h-10 w-10 shrink-0 rounded-full bg-white/80" />
          </div>
          <PulseBlock className="mt-4 h-16 w-full rounded-[1.35rem] bg-white/80" />
        </div>
      </div>

      <div className="space-y-3 px-4 pt-4">
        {[0, 1, 2, 3].map((row) => (
          <PulseBlock key={row} className="h-14 rounded-[1.1rem]" />
        ))}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 px-4 pb-4 pt-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <PulseBlock key={index} className="h-12 rounded-[1rem]" />
        ))}
      </div>
    </div>
  )
}

export function MobilePageSkeleton({ title, variant = 'list' }: MobilePageSkeletonProps) {
  if (variant === 'form') {
    return (
      <>
        <main className="min-h-screen bg-white text-slate-950">
          <section aria-busy="true" aria-label={`${title}載入中`} className="mx-auto min-h-screen w-full max-w-md">
            <h1 className="sr-only">{title}</h1>
            <FormSkeleton />
          </section>
        </main>
        <BottomNav />
      </>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section
          aria-busy="true"
          className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]"
        >
          <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
            <div className="flex h-[4.5rem] items-center px-5">
              <h1 className="text-[1.35rem] font-semibold tracking-normal text-[#202124]">{title}</h1>
            </div>
          </header>
          {variant === 'manager' ? <ManagerSkeleton /> : <ListSkeleton />}
        </section>
      </main>
      <BottomNav />
    </>
  )
}
