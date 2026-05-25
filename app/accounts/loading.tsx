export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
        <div className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
          <div className="flex h-[4.5rem] items-start gap-3 px-4 pt-2">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 animate-pulse" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="h-7 w-28 rounded-full bg-slate-100 animate-pulse" />
              <div className="mt-2 h-3 w-40 rounded-full bg-slate-100 animate-pulse" />
            </div>
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 animate-pulse" />
          </div>
        </div>

        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 border-b border-[#e3dbce] px-1">
            <div className="py-2">
              <div className="mx-auto h-4 w-12 rounded-full bg-slate-100 animate-pulse" />
              <div className="mx-auto mt-2 h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
            </div>
            <div className="py-2">
              <div className="mx-auto h-4 w-12 rounded-full bg-slate-100 animate-pulse" />
              <div className="mx-auto mt-2 h-3 w-16 rounded-full bg-slate-100 animate-pulse" />
            </div>
          </div>

          <div className="mt-3 rounded-[1.15rem] border border-dashed border-[#ddd4c5] bg-[#fcfbf8] px-4 py-5">
            <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
            <div className="mt-4 space-y-3">
              <div className="h-10 rounded-[0.9rem] bg-slate-100 animate-pulse" />
              <div className="h-10 rounded-[0.9rem] bg-slate-100 animate-pulse" />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="rounded-[1.15rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
              <div className="mt-3 h-16 rounded-[0.95rem] bg-slate-100 animate-pulse" />
            </div>
            <div className="rounded-[1.15rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
              <div className="mt-3 h-16 rounded-[0.95rem] bg-slate-100 animate-pulse" />
            </div>
            <div className="rounded-[1.15rem] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
              <div className="mt-3 h-16 rounded-[0.95rem] bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
