'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureDefaultHouseholdId } from '@/lib/household'
import { setBackupSchedule } from '@/lib/backup/config-db'
import type { BackupSchedule } from '@/lib/backup/schedule'
import { runBackup } from '@/lib/backup/run-backup'

async function resolveHouseholdId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  if (!admin) return null
  return ensureDefaultHouseholdId(admin, user)
}

export async function updateBackupSchedule(
  schedule: BackupSchedule,
): Promise<{ ok: boolean; error?: string }> {
  const householdId = await resolveHouseholdId()
  if (!householdId) return { ok: false, error: 'unauthorized' }
  const result = await setBackupSchedule(householdId, schedule)
  if (result.ok) revalidatePath('/more/backup')
  return result
}

export async function runBackupNow(): Promise<
  | { ok: true; skipped: false; fileName: string; sizeBytes: number }
  | { ok: true; skipped: true; reason: 'cooldown' }
  | { ok: false; error: string }
> {
  const householdId = await resolveHouseholdId()
  if (!householdId) return { ok: false, error: 'unauthorized' }
  const result = await runBackup({ householdId, triggeredBy: 'manual' })
  if (result.ok && !result.skipped) revalidatePath('/more/backup')
  return result
}
