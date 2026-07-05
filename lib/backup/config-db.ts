import { createAdminClient } from '@/lib/supabase/admin'
import type { BackupConfig, BackupSchedule } from './schedule'

const TABLE = 'family_backup_config'

const DEFAULT_ANCHOR = '2026-06-12'

const FALLBACK_CONFIG: BackupConfig = {
  schedule: 'biweekly',
  biweeklyAnchorDate: DEFAULT_ANCHOR,
  lastSentAt: null,
}

export async function getBackupConfig(householdId: string): Promise<BackupConfig> {
  try {
    const admin = createAdminClient()
    if (!admin) return FALLBACK_CONFIG
    const { data, error } = await admin
      .from(TABLE)
      .select('schedule, biweekly_anchor_date, last_sent_at')
      .eq('household_id', householdId)
      .maybeSingle()
    if (error || !data) {
      if (error) console.error('[backup/config-db] getBackupConfig failed', error)
      return FALLBACK_CONFIG
    }
    return {
      schedule: data.schedule as BackupSchedule,
      biweeklyAnchorDate: data.biweekly_anchor_date as string,
      lastSentAt: (data.last_sent_at as string | null) ?? null,
    }
  } catch (err) {
    console.error('[backup/config-db] getBackupConfig exception', err)
    return FALLBACK_CONFIG
  }
}

export async function setBackupSchedule(
  householdId: string,
  schedule: BackupSchedule,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient()
    if (!admin) return { ok: false, error: 'supabase admin unavailable' }
    const { error } = await admin
      .from(TABLE)
      .upsert(
        { household_id: householdId, schedule },
        { onConflict: 'household_id' },
      )
    if (error) {
      console.error('[backup/config-db] setBackupSchedule failed', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    console.error('[backup/config-db] setBackupSchedule exception', err)
    return { ok: false, error: (err as Error).message }
  }
}

export async function markBackupSent(householdId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!admin) return
    const { error } = await admin
      .from(TABLE)
      .update({ last_sent_at: new Date().toISOString() })
      .eq('household_id', householdId)
    if (error) console.error('[backup/config-db] markBackupSent failed', error)
  } catch (err) {
    console.error('[backup/config-db] markBackupSent exception', err)
  }
}
