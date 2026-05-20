import { BottomNav } from '@/components/BottomNav'
import { PageShell, softSurfaceClass, surfaceClass } from '@/components/PageShell'

const plannedItems = [
  '家庭設定',
  '通知偏好',
  '分類管理',
  '資料匯入與匯出',
]

export default function MorePage() {
  return (
    <PageShell
      title="更多"
      eyebrow="施工中"
      description="這裡之後會放更多設定與進階管理功能，現在先保留入口。"
      contentClassName="space-y-5"
    >
      <section className={`${surfaceClass} space-y-4`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-950 bg-[#fff45f] text-2xl font-black text-slate-950 shadow-[4px_4px_0_#111827]">
            ⋯
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950">更多功能施工中</h2>
            <p className="text-sm font-bold text-slate-600">
              目前先提供入口，後續會把設定相關功能集中放在這裡。
            </p>
          </div>
        </div>
      </section>

      <section className={`${softSurfaceClass} space-y-3`}>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">預計會放的項目</p>
        <div className="flex flex-wrap gap-2">
          {plannedItems.map(item => (
            <span
              key={item}
              className="rounded-full border-2 border-slate-950 bg-white px-3 py-1 text-xs font-black text-slate-950"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <BottomNav />
    </PageShell>
  )
}
