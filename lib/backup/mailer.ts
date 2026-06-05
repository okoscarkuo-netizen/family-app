import nodemailer from 'nodemailer'
import type { BackupCounts } from './excel'

export type SendBackupArgs = {
  fileName: string
  buffer: Buffer
  counts: BackupCounts
  triggeredBy: 'cron-biweekly' | 'cron-monthly' | 'manual'
  sentAt: Date
}

function describeTrigger(trigger: SendBackupArgs['triggeredBy']): string {
  if (trigger === 'cron-biweekly') return '雙週'
  if (trigger === 'cron-monthly') return '每月'
  return '手動'
}

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`missing env: ${name}`)
  return value
}

function formatPhoenix(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace('T', ' ')
}

export async function sendBackupEmail(args: SendBackupArgs): Promise<void> {
  const user = getEnv('GMAIL_USER')
  const pass = getEnv('GMAIL_APP_PASSWORD')
  const to = getEnv('BACKUP_TO_EMAIL')

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  })

  const desc = describeTrigger(args.triggeredBy)
  const ymd = args.fileName.replace('Family_App_Backup_', '').replace('.xlsx', '')
  const sizeMb = (args.buffer.byteLength / 1024 / 1024).toFixed(2)
  const c = args.counts

  const subject = `[Family App] ${ymd} ${desc}備份（共 ${c.transactions} 筆交易）`
  const text = [
    `你好 Oscar，`,
    ``,
    `這是 Family App 的${desc}自動備份。`,
    `備份時間：${formatPhoenix(args.sentAt)} (Phoenix)`,
    `資料筆數：`,
    `  帳戶 ${c.accounts}、交易 ${c.transactions}、週期 ${c.recurring}、分類 ${c.categories}`,
    `  商家 ${c.merchants}、商家群組 ${c.merchantGroups}、提醒 ${c.reminders}、匯率快照 ${c.exchangeRates}`,
    ``,
    `附件：${args.fileName} (${sizeMb} MB)`,
    ``,
    `—— Family App`,
  ].join('\n')

  let lastError: unknown = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await transporter.sendMail({
        from: `Family App <${user}>`,
        to,
        subject,
        text,
        attachments: [
          {
            filename: args.fileName,
            content: args.buffer,
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      })
      return
    } catch (err) {
      lastError = err
      console.error(`[backup/mailer] attempt ${attempt} failed`, err)
      if (attempt < 2) await new Promise((r) => setTimeout(r, 5000))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
