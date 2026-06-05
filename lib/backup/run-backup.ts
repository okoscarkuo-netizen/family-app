import { getBackupConfig, markBackupSent } from './config-db'
import { generateBackupExcel } from './excel'
import { sendBackupEmail, type SendBackupArgs } from './mailer'

const COOLDOWN_MS = 3 * 60 * 1000

export type RunBackupResult =
  | { ok: true; skipped: false; fileName: string; sizeBytes: number }
  | { ok: true; skipped: true; reason: 'cooldown' }
  | { ok: false; error: string }

export async function runBackup(args: {
  householdId: string
  triggeredBy: SendBackupArgs['triggeredBy']
  now?: Date
}): Promise<RunBackupResult> {
  const now = args.now ?? new Date()
  try {
    const config = await getBackupConfig(args.householdId)
    if (config.lastSentAt) {
      const last = new Date(config.lastSentAt)
      if (now.getTime() - last.getTime() < COOLDOWN_MS) {
        return { ok: true, skipped: true, reason: 'cooldown' }
      }
    }

    const excel = await generateBackupExcel(now)

    try {
      await sendBackupEmail({
        fileName: excel.fileName,
        buffer: excel.buffer,
        counts: excel.counts,
        triggeredBy: args.triggeredBy,
        sentAt: now,
      })
    } catch (mailErr) {
      console.error('[backup/run-backup] mail failed, attempting JSON fallback', mailErr)
      // Excel 沒問題、但寄信失敗 → 用 JSON 純文字 fallback 再寄一次
      const json = Buffer.from(
        JSON.stringify({ counts: excel.counts, generatedAt: now.toISOString() }, null, 2),
        'utf-8',
      )
      const jsonName = excel.fileName.replace('.xlsx', '.fallback.json')
      await sendBackupEmail({
        fileName: jsonName,
        buffer: json,
        counts: excel.counts,
        triggeredBy: args.triggeredBy,
        sentAt: now,
      })
    }

    await markBackupSent(args.householdId)
    return {
      ok: true,
      skipped: false,
      fileName: excel.fileName,
      sizeBytes: excel.buffer.byteLength,
    }
  } catch (err) {
    console.error('[backup/run-backup] failed', err)
    return { ok: false, error: (err as Error).message }
  }
}
