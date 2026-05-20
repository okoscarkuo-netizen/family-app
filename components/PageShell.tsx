import type { ReactNode } from 'react'

export const shellBackgroundClass =
  'min-h-screen bg-[#faf7f0] text-slate-950'

export const pageContainerClass =
  'mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:px-8'

export const centeredPageContainerClass =
  'mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8'

export const contentColumnClass = 'space-y-5'

export const surfaceClass =
  'rounded-[28px] border-2 border-slate-950 bg-white p-4 shadow-[8px_8px_0_#111827]'

export const accentSurfaceClass =
  'rounded-[28px] border-2 border-slate-950 bg-[#00c2ff] p-4 shadow-[8px_8px_0_#111827]'

export const softSurfaceClass =
  'rounded-[28px] border-2 border-slate-950 bg-[#fff45f] p-4 shadow-[8px_8px_0_#111827]'

export const primaryButtonClass =
  'inline-flex items-center justify-center rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_#111827] transition hover:-translate-y-0.5 hover:bg-[#e92b87]'

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border-2 border-slate-950 bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-[3px_3px_0_#111827] transition hover:-translate-y-0.5 hover:bg-[#e9fbff]'

export const subtleButtonClass =
  'inline-flex items-center justify-center rounded-md border-2 border-slate-950 bg-[#fff45f] px-4 py-2 text-sm font-black text-slate-950 shadow-[3px_3px_0_#111827] transition hover:-translate-y-0.5 hover:bg-[#ff8c42]'

export const inputClass =
  'w-full rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-base font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00c2ff]'

export const selectClass = inputClass

type PageShellProps = {
  title: string
  eyebrow?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  contentClassName?: string
  centered?: boolean
}

export function PageShell({
  title,
  eyebrow,
  description,
  action,
  children,
  contentClassName,
  centered = false,
}: PageShellProps) {
  return (
    <main className={shellBackgroundClass}>
      <div className={centered ? centeredPageContainerClass : pageContainerClass}>
        <div className={centered ? 'w-full max-w-md' : 'w-full'}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950 md:text-3xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 text-sm font-bold text-slate-600">{description}</p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>

          <div className={contentClassName ?? contentColumnClass}>{children}</div>
        </div>
      </div>
    </main>
  )
}
