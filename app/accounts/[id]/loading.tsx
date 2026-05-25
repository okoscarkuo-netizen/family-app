export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
      <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
        <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
          <div className="flex h-[4.5rem] items-start gap-3 px-4 pt-2">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 animate-pulse" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="h-6 w-32 rounded-full bg-slate-100 animate-pulse" />
              <div className="mt-2 h-3 w-44 rounded-full bg-slate-100 animate-pulse" />
            </div>
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 animate-pulse" />
          </div>
        </header>

        <div className="space-y-3 px-4 pt-4">
          <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="h-3 w-20 rounded-full bg-slate-100 animate-pulse" />
            <div className="mt-3 h-12 w-40 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="mt-3 h-3 w-52 rounded-full bg-slate-100 animate-pulse" />
          </section>

          <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
            <div className="h-10 rounded-[0.95rem] bg-slate-100 animate-pulse" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[0.95rem] bg-[#f2fffb] px-3 py-2.5">
                <div className="h-3 w-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="mt-2 h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
              </div>
              <div className="rounded-[0.95rem] bg-[#fef9f0] px-3 py-2.5">
                <div className="h-3 w-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="mt-2 h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
              </div>
            </div>
            <div className="mt-2 h-3 w-36 rounded-full bg-slate-100 animate-pulse" />
          </section>
        </div>

        <div className="mt-2 space-y-2 px-4">
          <div className="rounded-[1.1rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
            <div className="mt-3 space-y-2">
              <div className="h-14 rounded-[0.95rem] bg-slate-100 animate-pulse" />
              <div className="h-14 rounded-[0.95rem] bg-slate-100 animate-pulse" />
            </div>
          </div>
          <div className="rounded-[1.1rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="h-4 w-28 rounded-full bg-slate-100 animate-pulse" />
            <div className="mt-3 space-y-2">
              <div className="h-14 rounded-[0.95rem] bg-slate-100 animate-pulse" />
              <div className="h-14 rounded-[0.95rem] bg-slate-100 animate-pulse" />
              <div className="h-14 rounded-[0.95rem] bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
