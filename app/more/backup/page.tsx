import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureDefaultHouseholdId } from '@/lib/household'
import { getBackupConfig } from '@/lib/backup/config-db'
import { nextSendDate, formatDateYmd, type BackupConfig } from '@/lib/backup/schedule'
import { BackupSettings } from './_components/BackupSettings'

export const dynamic = 'force-dynamic'

const FALLBACK_CONFIG: BackupConfig = {
  schedule: 'biweekly',
  biweeklyAnchorDate: '2026-06-12',
  lastSentAt: null,
}

async function loadConfig(): Promise<BackupConfig> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return FALLBACK_CONFIG
    const admin = createAdminClient()
    if (!admin) return FALLBACK_CONFIG
    const householdId = await ensureDefaultHouseholdId(admin, user)
    return await getBackupConfig(householdId)
  } catch (err) {
    console.error('[more/backup] loadConfig failed', err)
    return FALLBACK_CONFIG
  }
}

export default async function BackupPage() {
  const config = await loadConfig()
  const today = new Date()
  const next = nextSendDate(today, config)
  const toEmail = process.env.BACKUP_TO_EMAIL ?? '（尚未設定）'

  return (
    <>
      <main className="min-h-screen bg-[#f2f3f1] text-[#1f2328]">
        <section className="mx-auto min-h-screen w-full max-w-md bg-white pb-32 shadow-[0_0_42px_rgba(15,23,42,0.08)]">
          <header className="sticky top-0 z-30 border-b border-[#eeeeec] bg-white/95 backdrop-blur">
            <div className="flex h-[4.5rem] items-center gap-3 px-5">
              <Link href="/more" className="text-xl leading-none text-slate-400" aria-label="返回更多頁">‹</Link>
              <h1 className="text-[1.35rem] font-semibold tracking-normal text-[#202124]">資料備份</h1>
            </div>
          </header>

          <div className="space-y-3 px-4 pt-4">
            <BackupSettings
              schedule={config.schedule}
              nextSendDateYmd={formatDateYmd(next)}
              lastSentAt={config.lastSentAt}
              toEmail={toEmail}
            />
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  )
}
