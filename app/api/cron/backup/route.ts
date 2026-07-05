import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBackupConfig } from '@/lib/backup/config-db'
import { shouldSendToday } from '@/lib/backup/schedule'
import { runBackup } from '@/lib/backup/run-backup'

export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

function missingSecret() {
  return NextResponse.json(
    { error: 'missing_cron_secret', message: 'Set CRON_SECRET in your Vercel project.' },
    { status: 500 },
  )
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return missingSecret()
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) return unauthorized()
  return null
}

export async function GET(request: NextRequest) {
  const authResponse = isAuthorized(request)
  if (authResponse) return authResponse

  try {
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'no_admin_client' }, { status: 500 })
    }

    const { data: households, error } = await admin.from('households').select('id')
    if (error) {
      console.error('[cron/backup] list households failed', error)
      return NextResponse.json({ error: 'list_households_failed' }, { status: 500 })
    }

    const today = new Date()
    const results: Array<Record<string, unknown>> = []

    for (const h of households ?? []) {
      const householdId = h.id as string
      const config = await getBackupConfig(householdId)
      if (!shouldSendToday(today, config)) {
        results.push({ householdId, skipped: true, reason: 'not_scheduled' })
        continue
      }
      const triggeredBy =
        config.schedule === 'monthly' ? 'cron-monthly' : 'cron-biweekly'
      const result = await runBackup({ householdId, triggeredBy, now: today })
      results.push({ householdId, ...result })
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[cron/backup] uncaught error', err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}
