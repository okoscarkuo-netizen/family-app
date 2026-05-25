export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] pb-24">
      <div className="mx-auto max-w-md space-y-3 px-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="h-6 w-24 rounded-full bg-white/75 shadow-[0_8px_24px_rgba(15,23,42,0.04)] animate-pulse" />
          <div className="h-9 w-20 rounded-full border border-[#d8e3df] bg-[#f7faf8] animate-pulse" />
        </div>

        <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div className="h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
            <div className="h-5 w-5 rounded-full bg-slate-100 animate-pulse" />
          </div>
          <div className="mt-4 h-12 w-40 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="mt-3 h-4 w-28 rounded-full bg-slate-100 animate-pulse" />
          <div className="mt-4 h-56 w-full rounded-2xl bg-slate-100 animate-pulse" />
          <div className="mt-2 h-5 w-full rounded-full bg-slate-100 animate-pulse" />
        </section>

        <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
          <div className="mt-5 h-20 rounded-[1rem] bg-slate-100 animate-pulse" />
        </section>

        <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
          <div className="h-4 w-20 rounded-full bg-slate-100 animate-pulse" />
          <div className="mt-4 space-y-3">
            <div className="h-12 rounded-[1rem] bg-slate-100 animate-pulse" />
            <div className="h-12 rounded-[1rem] bg-slate-100 animate-pulse" />
            <div className="h-12 rounded-[1rem] bg-slate-100 animate-pulse" />
          </div>
        </section>
      </div>
    </main>
  )
}
