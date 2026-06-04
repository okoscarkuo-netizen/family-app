# Family App 自動備份 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/more/backup` 提供雙週/每月切換 + 立即備份按鈕，並由 Vercel Cron 每週五依設定自動把全部資料打包成 Excel 寄到 Gmail，Anchor 從 2026-06-12 起跑。

**Architecture:** 新表 `family_backup_config` 存頻率/anchor/last_sent_at；orchestrator `runBackup()` 共用給 cron 與 server action；Excel 由 ExcelJS 產生 8 個分頁的 Buffer；Gmail SMTP 透過 Nodemailer 寄出附件；3 分鐘 cooldown 防雙寄。

**Tech Stack:** Next.js 16 App Router、React 19、Supabase Postgres、Vercel Cron、ExcelJS、Nodemailer、TypeScript。專案無單元測試，每個任務以 `npx tsc --noEmit` + `npm run build` + Vercel preview 手動驗證。對應設計：`docs/superpowers/specs/2026-06-04-family-app-backup-design.md`。

---

## File Responsibility Map

| 檔案 | 責任 |
|---|---|
| `supabase/migrations/20260604000000_family_backup_config.sql` | 建 `family_backup_config` 表、預設一筆 |
| `lib/backup/schedule.ts` | 純函式：`shouldSendToday`、`nextSendDate`、`firstFridayOfMonth` |
| `lib/backup/config-db.ts` | 讀寫 `family_backup_config`（單一 household） |
| `lib/backup/excel.ts` | 抓 8 張表的 row → 用 ExcelJS 產生 .xlsx Buffer |
| `lib/backup/mailer.ts` | Nodemailer 包裝：建立 transporter、寄送附件 |
| `lib/backup/run-backup.ts` | Orchestrator：cooldown 檢查 → excel → mail → 寫回 `last_sent_at` |
| `app/api/cron/backup/route.ts` | Cron 入口：CRON_SECRET 驗證 → 讀 config → `shouldSendToday` → `runBackup` |
| `app/actions/backup.ts` | Server actions：`updateBackupSchedule`、`runBackupNow` |
| `app/more/backup/page.tsx` | 備份頁 Server Component（抓 config、算 next/last） |
| `app/more/backup/_components/BackupSettings.tsx` | UI：頻率切換、立即備份按鈕、結果回饋 |
| `app/more/page.tsx` | 在 quickLinks 加入「資料備份」入口（modify） |
| `vercel.json` | 多一條 `/api/cron/backup` 排程（modify） |
| `.env.local` | 新增 `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `BACKUP_TO_EMAIL` |
| `package.json` | 新依賴 `exceljs`、`nodemailer`、`@types/nodemailer` |

---

## Task 1: 安裝依賴 + 建立資料夾骨架

**Files:**
- Modify: `package.json`、`package-lock.json`
- Create: `lib/backup/` 目錄（透過建立第一個檔案產生）

- [ ] **Step 1: 安裝套件**

Run:
```bash
npm install exceljs nodemailer
npm install -D @types/nodemailer
```

Expected：`exceljs`、`nodemailer` 進 `dependencies`，`@types/nodemailer` 進 `devDependencies`。

- [ ] **Step 2: 確認 build 不會壞**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(backup): 安裝 exceljs 與 nodemailer 依賴"
```

---

## Task 2: Migration — 建 family_backup_config

**Files:**
- Create: `supabase/migrations/20260604000000_family_backup_config.sql`

- [ ] **Step 1: 寫 migration SQL**

寫入以下內容到 `supabase/migrations/20260604000000_family_backup_config.sql`：

```sql
-- Family App backup configuration (single row per household)
create table if not exists public.family_backup_config (
  household_id uuid primary key references public.households(id) on delete cascade,
  schedule text not null default 'biweekly' check (schedule in ('biweekly', 'monthly')),
  biweekly_anchor_date date not null default '2026-06-12',
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Auto-update timestamp
create or replace function public.set_family_backup_config_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists family_backup_config_updated_at on public.family_backup_config;
create trigger family_backup_config_updated_at
  before update on public.family_backup_config
  for each row execute function public.set_family_backup_config_updated_at();

-- Seed default row for every existing household
insert into public.family_backup_config (household_id)
select id from public.households
on conflict (household_id) do nothing;

-- RLS — only household members can read/write their config
alter table public.family_backup_config enable row level security;

drop policy if exists "household members can read backup config"
  on public.family_backup_config;
create policy "household members can read backup config"
  on public.family_backup_config for select
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

drop policy if exists "household members can upsert backup config"
  on public.family_backup_config;
create policy "household members can upsert backup config"
  on public.family_backup_config for all
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: 套用 migration 到本地 + production**

Run（依專案習慣，CLAUDE.md 雷 1 提醒新欄位必須同步 production）：
```bash
# 本地：用 Supabase CLI 或 dashboard SQL editor
# Production：用 dashboard SQL editor 跑同一段 SQL
```

Expected：本地與 production 都有 `family_backup_config` 表，且既有 household 都有一筆預設 row（`schedule='biweekly'`、`biweekly_anchor_date='2026-06-12'`）。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260604000000_family_backup_config.sql
git commit -m "feat(backup): 建立 family_backup_config 資料表"
```

---

## Task 3: lib/backup/schedule.ts — 純函式排程邏輯

**Files:**
- Create: `lib/backup/schedule.ts`

- [ ] **Step 1: 建立 schedule.ts**

寫入以下內容到 `lib/backup/schedule.ts`：

```typescript
export type BackupSchedule = 'biweekly' | 'monthly'

export type BackupConfig = {
  schedule: BackupSchedule
  biweeklyAnchorDate: string // YYYY-MM-DD
  lastSentAt: string | null // ISO timestamp
}

function toUtcDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function isFriday(date: Date): boolean {
  return date.getUTCDay() === 5
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / 86_400_000)
}

export function firstFridayOfMonth(year: number, month: number): Date {
  // month: 1-12
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (5 - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month - 1, 1 + offset))
}

export function shouldSendToday(today: Date, config: BackupConfig): boolean {
  if (!isFriday(today)) return false

  if (config.schedule === 'biweekly') {
    const anchor = toUtcDate(config.biweeklyAnchorDate)
    const diff = daysBetween(today, anchor)
    return diff >= 0 && diff % 14 === 0
  }

  if (config.schedule === 'monthly') {
    const target = firstFridayOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1)
    return (
      today.getUTCFullYear() === target.getUTCFullYear() &&
      today.getUTCMonth() === target.getUTCMonth() &&
      today.getUTCDate() === target.getUTCDate()
    )
  }

  return false
}

export function nextSendDate(today: Date, config: BackupConfig): Date {
  if (config.schedule === 'biweekly') {
    const anchor = toUtcDate(config.biweeklyAnchorDate)
    if (today.getTime() <= anchor.getTime()) return anchor
    const diff = daysBetween(today, anchor)
    const remainder = diff % 14
    const addDays = remainder === 0 ? 0 : 14 - remainder
    const next = new Date(today.getTime() + addDays * 86_400_000)
    return next
  }

  // monthly: this month's first Friday if still in future-or-today, else next month's
  const thisMonthFri = firstFridayOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1)
  if (thisMonthFri.getTime() >= today.getTime()) return thisMonthFri
  let y = today.getUTCFullYear()
  let m = today.getUTCMonth() + 2 // next month, 1-based
  if (m > 12) {
    m = 1
    y += 1
  }
  return firstFridayOfMonth(y, m)
}

export function formatDateYmd(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

- [ ] **Step 2: 型別檢查**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 3: 手動驗證邏輯（用 Node REPL）**

Run:
```bash
node --input-type=module -e "
import('./lib/backup/schedule.ts').then(m => {
  const cfg = { schedule: 'biweekly', biweeklyAnchorDate: '2026-06-12', lastSentAt: null };
  console.log('Anchor day shouldSendToday:', m.shouldSendToday(new Date('2026-06-12T00:00:00Z'), cfg));
  console.log('Anchor +14 shouldSendToday:', m.shouldSendToday(new Date('2026-06-26T00:00:00Z'), cfg));
  console.log('Anchor +7 shouldSendToday:', m.shouldSendToday(new Date('2026-06-19T00:00:00Z'), cfg));
  console.log('Next from 2026-06-04:', m.formatDateYmd(m.nextSendDate(new Date('2026-06-04T00:00:00Z'), cfg)));
  const monthlyCfg = { ...cfg, schedule: 'monthly' };
  console.log('Monthly next from 2026-06-04:', m.formatDateYmd(m.nextSendDate(new Date('2026-06-04T00:00:00Z'), monthlyCfg)));
})
"
```

Expected:
```
Anchor day shouldSendToday: true
Anchor +14 shouldSendToday: true
Anchor +7 shouldSendToday: false
Next from 2026-06-04: 2026-06-12
Monthly next from 2026-06-04: 2026-06-05
```

（如果 Node 無法直接 import `.ts`，改用 `tsx` 或先 `npm run build` 再執行。實作者自行調整，本步驟只是手動 sanity check。）

- [ ] **Step 4: Commit**

```bash
git add lib/backup/schedule.ts
git commit -m "feat(backup): 加入排程判斷與下一個寄送日純函式"
```

---

## Task 4: lib/backup/config-db.ts — 讀寫設定

**Files:**
- Create: `lib/backup/config-db.ts`

- [ ] **Step 1: 建立 config-db.ts**

寫入以下內容到 `lib/backup/config-db.ts`：

```typescript
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
```

- [ ] **Step 2: 型別檢查 + build**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 3: Commit**

```bash
git add lib/backup/config-db.ts
git commit -m "feat(backup): 加入 family_backup_config 讀寫 helper"
```

---

## Task 5: lib/backup/excel.ts — 產生 8 分頁 Excel Buffer

**Files:**
- Create: `lib/backup/excel.ts`

- [ ] **Step 1: 建立 excel.ts**

寫入以下內容到 `lib/backup/excel.ts`：

```typescript
import ExcelJS from 'exceljs'
import { createAdminClient } from '@/lib/supabase/admin'

export type BackupCounts = {
  accounts: number
  transactions: number
  recurring: number
  categories: number
  merchants: number
  merchantGroups: number
  reminders: number
  exchangeRates: number
}

export type BackupExcelResult = {
  buffer: Buffer
  counts: BackupCounts
  fileName: string
}

type Lookup = Map<string, string>

function buildLookup(rows: { id: string; name: string }[]): Lookup {
  const m = new Map<string, string>()
  for (const r of rows) m.set(r.id, r.name)
  return m
}

function styleHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  sheet.columns = headers.map((h) => ({ header: h, width: Math.max(12, h.length * 2) }))
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEDEDED' },
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function fmtDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function generateBackupExcel(today: Date): Promise<BackupExcelResult> {
  const admin = createAdminClient()
  if (!admin) throw new Error('supabase admin client unavailable')

  // 1. 抓所有 row（順序：先抓被當 lookup 的）
  const [accountsRes, categoriesRes, merchantsRes, merchantGroupsRes] = await Promise.all([
    admin.from('family_accounts').select('*').order('name'),
    admin.from('family_categories').select('*').order('display_order'),
    admin.from('family_merchants').select('*').order('name'),
    admin.from('family_merchant_groups').select('*').order('display_order'),
  ])
  for (const r of [accountsRes, categoriesRes, merchantsRes, merchantGroupsRes]) {
    if (r.error) throw new Error(`fetch failed: ${r.error.message}`)
  }
  const accounts = accountsRes.data ?? []
  const categories = categoriesRes.data ?? []
  const merchants = merchantsRes.data ?? []
  const merchantGroups = merchantGroupsRes.data ?? []

  const accountName = buildLookup(accounts as { id: string; name: string }[])
  const categoryName = buildLookup(categories as { id: string; name: string }[])
  const merchantName = buildLookup(merchants as { id: string; name: string }[])
  const merchantGroupName = buildLookup(
    merchantGroups as { id: string; name: string }[],
  )

  const [transactionsRes, recurringRes, remindersRes, ratesRes] = await Promise.all([
    admin.from('family_transactions').select('*').order('occurred_at', { ascending: false }),
    admin.from('recurring_transactions').select('*').order('next_due_date'),
    admin.from('maintenance_reminders').select('*').order('due_date'),
    admin
      .from('exchange_rate_snapshots')
      .select('*')
      .gte(
        'snapshot_date',
        new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10),
      )
      .order('snapshot_date', { ascending: false }),
  ])
  for (const r of [transactionsRes, recurringRes, remindersRes, ratesRes]) {
    if (r.error) throw new Error(`fetch failed: ${r.error.message}`)
  }
  const transactions = transactionsRes.data ?? []
  const recurring = recurringRes.data ?? []
  const reminders = remindersRes.data ?? []
  const rates = ratesRes.data ?? []

  // 2. 建 workbook
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Family App'
  wb.created = new Date()

  // Sheet 1: 帳戶
  const sAcc = wb.addWorksheet('帳戶')
  styleHeader(sAcc, [
    '帳戶ID', '名稱', '類別', '幣別', '期初餘額', '開帳日', '備註', '隱藏', '常用',
  ])
  for (const a of accounts as Record<string, unknown>[]) {
    sAcc.addRow([
      a.id,
      a.name,
      a.category,
      a.currency,
      a.opening_balance ?? 0,
      fmtDate(a.balance_date as string | null),
      a.remark ?? '',
      a.hidden ? 'Y' : '',
      a.favorite ? 'Y' : '',
    ])
  }

  // Sheet 2: 交易
  const sTxn = wb.addWorksheet('交易')
  styleHeader(sTxn, [
    '交易ID', '日期', '類型', '金額', '幣別', '帳戶ID', '帳戶名稱',
    '對方帳戶ID', '對方帳戶名稱', '分類ID', '分類名稱',
    '商家ID', '商家名稱', '擁有者', '備註',
  ])
  for (const t of transactions as Record<string, unknown>[]) {
    const accId = t.account_id as string | null
    const targetId = t.target_account_id as string | null
    const catId = t.category_id as string | null
    const merId = t.merchant_id as string | null
    sTxn.addRow([
      t.id,
      fmtDate(t.occurred_at as string),
      t.kind,
      t.amount ?? 0,
      t.currency,
      accId,
      accId ? accountName.get(accId) ?? '' : '',
      targetId,
      targetId ? accountName.get(targetId) ?? '' : '',
      catId,
      catId ? categoryName.get(catId) ?? '' : '',
      merId,
      merId ? merchantName.get(merId) ?? '' : '',
      t.owner,
      t.notes ?? '',
    ])
  }

  // Sheet 3: 週期交易
  const sRec = wb.addWorksheet('週期交易')
  styleHeader(sRec, [
    '週期ID', '名稱', '類型', '金額', '幣別', '帳戶ID', '帳戶名稱',
    '分類ID', '分類名稱', '頻率', '起始日', '下次執行日', '已停用',
  ])
  for (const r of recurring as Record<string, unknown>[]) {
    const accId = r.account_id as string | null
    const catId = r.category_id as string | null
    sRec.addRow([
      r.id,
      r.name,
      r.kind,
      r.amount ?? 0,
      r.currency,
      accId,
      accId ? accountName.get(accId) ?? '' : '',
      catId,
      catId ? categoryName.get(catId) ?? '' : '',
      r.frequency,
      fmtDate(r.start_date as string | null),
      fmtDate(r.next_due_date as string | null),
      r.is_active === false ? 'Y' : '',
    ])
  }

  // Sheet 4: 分類
  const sCat = wb.addWorksheet('分類')
  styleHeader(sCat, ['分類ID', '名稱', '父分類ID', '父分類名稱', '類型', '顯示順序'])
  for (const c of categories as Record<string, unknown>[]) {
    const parentId = c.parent_id as string | null
    sCat.addRow([
      c.id,
      c.name,
      parentId,
      parentId ? categoryName.get(parentId) ?? '' : '',
      c.kind,
      c.display_order ?? 0,
    ])
  }

  // Sheet 5: 商家
  const sMer = wb.addWorksheet('商家')
  styleHeader(sMer, [
    '商家ID', '名稱', '群組ID', '群組名稱', '預設分類ID', '預設分類名稱',
  ])
  for (const m of merchants as Record<string, unknown>[]) {
    const groupId = m.group_id as string | null
    const catId = m.default_category_id as string | null
    sMer.addRow([
      m.id,
      m.name,
      groupId,
      groupId ? merchantGroupName.get(groupId) ?? '' : '',
      catId,
      catId ? categoryName.get(catId) ?? '' : '',
    ])
  }

  // Sheet 6: 商家群組
  const sGrp = wb.addWorksheet('商家群組')
  styleHeader(sGrp, ['群組ID', '名稱', '顯示順序'])
  for (const g of merchantGroups as Record<string, unknown>[]) {
    sGrp.addRow([g.id, g.name, g.display_order ?? 0])
  }

  // Sheet 7: 提醒事項
  const sRem = wb.addWorksheet('提醒事項')
  styleHeader(sRem, [
    '提醒ID', '標題', '帳戶ID', '帳戶名稱', '到期日', '頻率', '分類', '備註', '已完成',
  ])
  for (const r of reminders as Record<string, unknown>[]) {
    const accId = r.account_id as string | null
    sRem.addRow([
      r.id,
      r.title,
      accId,
      accId ? accountName.get(accId) ?? '' : '',
      fmtDate(r.due_date as string | null),
      r.frequency ?? '',
      r.category ?? '',
      r.notes ?? '',
      r.completed_at ? 'Y' : '',
    ])
  }

  // Sheet 8: 匯率快照
  const sRate = wb.addWorksheet('匯率快照')
  styleHeader(sRate, ['日期', '來源幣別', '目標幣別', '匯率'])
  for (const r of rates as Record<string, unknown>[]) {
    sRate.addRow([
      fmtDate(r.snapshot_date as string | null),
      r.source_currency,
      r.target_currency,
      r.rate ?? 0,
    ])
  }

  const arrayBuffer = await wb.xlsx.writeBuffer()
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
  const ymd = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
  const fileName = `Family_App_Backup_${ymd}.xlsx`

  return {
    buffer,
    fileName,
    counts: {
      accounts: accounts.length,
      transactions: transactions.length,
      recurring: recurring.length,
      categories: categories.length,
      merchants: merchants.length,
      merchantGroups: merchantGroups.length,
      reminders: reminders.length,
      exchangeRates: rates.length,
    },
  }
}
```

- [ ] **Step 2: 確認欄位名跟實際 schema 一致**

Run（檢查每張表都有用到的欄位）：
```bash
grep -hE "create table|add column|alter table" supabase/migrations/*.sql | head -80
```

如果 schema 跟程式碼欄位名不一致（例如 `kind` 在實際 schema 是 `type`），修正 `excel.ts` 內對應 row 屬性。常見要確認的欄位：
- `family_accounts`：`category`、`opening_balance`、`balance_date`、`remark`、`hidden`、`favorite`
- `family_transactions`：`kind`、`occurred_at`、`target_account_id`、`category_id`、`merchant_id`、`owner`、`notes`
- `family_categories`：`parent_id`、`kind`、`display_order`
- `family_merchants`：`group_id`、`default_category_id`
- `maintenance_reminders`：`account_id`、`due_date`、`frequency`、`category`、`notes`、`completed_at`
- `exchange_rate_snapshots`：`snapshot_date`、`source_currency`、`target_currency`、`rate`

Expected：所有欄位都對得起來；不對的就改 `excel.ts`，**不要**反過來改 schema。

- [ ] **Step 3: 型別檢查**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 4: Commit**

```bash
git add lib/backup/excel.ts
git commit -m "feat(backup): 用 ExcelJS 產生 8 分頁備份檔"
```

---

## Task 6: lib/backup/mailer.ts — Gmail SMTP 寄信

**Files:**
- Create: `lib/backup/mailer.ts`

- [ ] **Step 1: 建立 mailer.ts**

寫入以下內容到 `lib/backup/mailer.ts`：

```typescript
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
  const ymd = args.fileName
    .replace('Family_App_Backup_', '')
    .replace('.xlsx', '')
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
```

- [ ] **Step 2: 型別檢查**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 3: Commit**

```bash
git add lib/backup/mailer.ts
git commit -m "feat(backup): 加入 Gmail SMTP 寄信 helper"
```

---

## Task 7: lib/backup/run-backup.ts — Orchestrator + Cooldown

**Files:**
- Create: `lib/backup/run-backup.ts`

- [ ] **Step 1: 建立 run-backup.ts**

寫入以下內容到 `lib/backup/run-backup.ts`：

```typescript
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
```

- [ ] **Step 2: 型別檢查**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 3: Commit**

```bash
git add lib/backup/run-backup.ts
git commit -m "feat(backup): 加入 orchestrator 與 3 分鐘 cooldown"
```

---

## Task 8: app/api/cron/backup/route.ts — Cron 入口

**Files:**
- Create: `app/api/cron/backup/route.ts`

- [ ] **Step 1: 建立 route.ts**

寫入以下內容到 `app/api/cron/backup/route.ts`：

```typescript
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
```

- [ ] **Step 2: 型別檢查 + build**

Run:
```bash
npx tsc --noEmit && npm run build
```

Expected: 0 errors，build 成功。

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/backup/route.ts
git commit -m "feat(backup): 加入 /api/cron/backup 排程入口"
```

---

## Task 9: app/actions/backup.ts — Server Actions

**Files:**
- Create: `app/actions/backup.ts`

- [ ] **Step 1: 建立 backup.ts server action**

寫入以下內容到 `app/actions/backup.ts`：

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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
  | { ok: true; fileName: string; sizeBytes: number }
  | { ok: true; skipped: true; reason: 'cooldown' }
  | { ok: false; error: string }
> {
  const householdId = await resolveHouseholdId()
  if (!householdId) return { ok: false, error: 'unauthorized' }
  const result = await runBackup({ householdId, triggeredBy: 'manual' })
  if (result.ok && !result.skipped) revalidatePath('/more/backup')
  return result
}
```

- [ ] **Step 2: 確認 ensureDefaultHouseholdId 簽名一致**

Run:
```bash
grep -n "ensureDefaultHouseholdId" lib/household.ts
```

Expected: 看到 `export async function ensureDefaultHouseholdId(supabase, user)`。如果簽名不同，調整呼叫方式（這個函式既存於 lib/household.ts，依其實際參數順序傳入）。

- [ ] **Step 3: 型別檢查**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors。

- [ ] **Step 4: Commit**

```bash
git add app/actions/backup.ts
git commit -m "feat(backup): 加入備份設定與立即備份 server actions"
```

---

## Task 10: UI — 備份專頁 + 切換 + 立即備份

**Files:**
- Create: `app/more/backup/page.tsx`
- Create: `app/more/backup/_components/BackupSettings.tsx`

- [ ] **Step 1: 建立 server component page**

寫入以下內容到 `app/more/backup/page.tsx`：

```typescript
import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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
              <Link href="/more" className="text-xl leading-none text-slate-400">‹</Link>
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
```

- [ ] **Step 2: 建立 client component**

寫入以下內容到 `app/more/backup/_components/BackupSettings.tsx`：

```typescript
'use client'

import { useState, useTransition } from 'react'
import { runBackupNow, updateBackupSchedule } from '@/app/actions/backup'
import type { BackupSchedule } from '@/lib/backup/schedule'

type Props = {
  schedule: BackupSchedule
  nextSendDateYmd: string
  lastSentAt: string | null
  toEmail: string
}

function formatLastSent(iso: string | null): string {
  if (!iso) return '尚未寄送'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function BackupSettings({ schedule, nextSendDateYmd, lastSentAt, toEmail }: Props) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<
    | { type: 'success'; text: string }
    | { type: 'error'; text: string }
    | { type: 'info'; text: string }
    | null
  >(null)

  const handleSwitch = (next: BackupSchedule) => {
    if (next === schedule || pending) return
    startTransition(async () => {
      const result = await updateBackupSchedule(next)
      if (result.ok) {
        setFeedback({ type: 'success', text: `已切換為${next === 'biweekly' ? '每兩週' : '每月'}` })
      } else {
        setFeedback({ type: 'error', text: `切換失敗：${result.error ?? 'unknown'}` })
      }
    })
  }

  const handleRunNow = () => {
    if (pending) return
    setFeedback(null)
    startTransition(async () => {
      const result = await runBackupNow()
      if (!result.ok) {
        setFeedback({ type: 'error', text: `備份失敗：${result.error}` })
        return
      }
      if ('skipped' in result && result.skipped) {
        setFeedback({ type: 'info', text: '3 分鐘內已備份過，請稍後再試' })
        return
      }
      const mb = (result.sizeBytes / 1024 / 1024).toFixed(2)
      setFeedback({ type: 'success', text: `✅ 已寄出 ${mb} MB（${result.fileName}）` })
    })
  }

  const btnBase =
    'flex-1 rounded-2xl border px-4 py-3 text-sm font-bold transition'
  const btnActive =
    'border-[#2f7d3b] bg-[#e8f4ea] text-[#1c5024] shadow-[0_2px_8px_rgba(47,125,59,0.18)]'
  const btnIdle = 'border-[#ece4d8] bg-white text-slate-500 hover:bg-[#fbfaf7]'

  const feedbackColor =
    feedback?.type === 'success'
      ? 'text-[#2f7d3b]'
      : feedback?.type === 'error'
        ? 'text-[#c9563f]'
        : 'text-slate-500'

  return (
    <>
      <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">自動備份頻率</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleSwitch('biweekly')}
            className={`${btnBase} ${schedule === 'biweekly' ? btnActive : btnIdle}`}
          >
            每兩週
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleSwitch('monthly')}
            className={`${btnBase} ${schedule === 'monthly' ? btnActive : btnIdle}`}
          >
            每月
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm font-bold text-slate-700">
          <div className="flex justify-between"><span>下次寄送</span><span>{nextSendDateYmd}（週五）</span></div>
          <div className="flex justify-between"><span>上次寄送</span><span>{formatLastSent(lastSentAt)}</span></div>
          <div className="flex justify-between"><span>寄送到</span><span className="truncate max-w-[60%]">{toEmail}</span></div>
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          disabled={pending}
          onClick={handleRunNow}
          className="w-full rounded-2xl bg-[#2f7d3b] py-3 text-sm font-black text-white shadow-[0_4px_12px_rgba(47,125,59,0.28)] disabled:opacity-60"
        >
          {pending ? '處理中…' : '立即備份（寄出）'}
        </button>
        {feedback ? (
          <p className={`mt-3 text-xs font-bold ${feedbackColor}`}>{feedback.text}</p>
        ) : null}
      </section>

      <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">說明</p>
        <ul className="mt-2 space-y-1 text-xs font-bold text-slate-500">
          <li>• 每兩週 = 從 2026-06-12 起，每隔 14 天的週五</li>
          <li>• 每月 = 每月第一個週五</li>
          <li>• Excel 含全部資料（8 張分頁）</li>
          <li>• 3 分鐘內按多次只會寄一次</li>
        </ul>
      </section>
    </>
  )
}
```

- [ ] **Step 3: 型別檢查 + build**

Run:
```bash
npx tsc --noEmit && npm run build
```

Expected: 0 errors，build 成功。

- [ ] **Step 4: Commit**

```bash
git add app/more/backup/
git commit -m "feat(backup): 加入 /more/backup 專頁與切換 UI"
```

---

## Task 11: 入口連結 + Vercel Cron 設定

**Files:**
- Modify: `app/more/page.tsx`
- Modify: `vercel.json`

- [ ] **Step 1: 在 quickLinks 加備份入口**

修改 `app/more/page.tsx` 第 4-25 行的 `quickLinks` 陣列，在 `定期交易` 與 `Passkey 管理` 之間插入：

```typescript
  {
    href: '/more/backup',
    title: '資料備份',
    description: '自動把全部資料打包成 Excel 寄到信箱，可切換每兩週或每月。',
  },
```

- [ ] **Step 2: 在 vercel.json 加 cron**

修改 `vercel.json`，在 `crons` 陣列尾端追加：

```json
    {
      "path": "/api/cron/backup",
      "schedule": "0 14 * * 5"
    }
```

完成後 `vercel.json` 應該長這樣：

```json
{
  "crons": [
    {
      "path": "/api/cron/exchange-rates",
      "schedule": "10 5 * * *"
    },
    {
      "path": "/api/cron/recurring-transactions",
      "schedule": "0 14 * * 5"
    },
    {
      "path": "/api/cron/backup",
      "schedule": "0 14 * * 5"
    }
  ]
}
```

> 註：recurring-transactions 既有是 `0 14 * * 5`（也是週五），這代表現在已有的 weekly schedule 跟 backup 撞同一刻 —— 沒問題，Vercel 會平行觸發兩個獨立 endpoint，互不影響。但若 recurring-transactions 應該是每日，請使用者自行確認其 schedule 是否要改回 `0 14 * * *`。**本任務不修改 recurring 那條**，只新增 backup。

- [ ] **Step 3: 型別檢查 + build**

Run:
```bash
npx tsc --noEmit && npm run build
```

Expected: 0 errors，build 成功。

- [ ] **Step 4: Commit**

```bash
git add app/more/page.tsx vercel.json
git commit -m "feat(backup): 加入備份頁入口與 Vercel cron 排程"
```

---

## Task 12: 環境變數設定（人工 + 文件）

**Files:**
- Modify: `.env.local`（本機）
- 不 commit `.env.local`

- [ ] **Step 1: 取得 Gmail App Password**

人工步驟（使用者要做）：
1. 開啟 Google 帳號 → 安全性 → 兩步驟驗證 → 啟用（若已啟用跳過）。
2. 開啟 Google 帳號 → 安全性 → 應用程式密碼 → 建立 → 名稱填「Family App Backup」。
3. 複製 16 字元密碼（只會顯示一次）。

- [ ] **Step 2: 設定本機 `.env.local`**

把以下三行加進 `.env.local`：

```
GMAIL_USER=ok.oscar.kuo@gmail.com
GMAIL_APP_PASSWORD=<貼上 16 字元 App Password>
BACKUP_TO_EMAIL=ok.oscar.kuo@gmail.com
```

- [ ] **Step 3: 設定 Vercel 三個環境**

Run（依 CLAUDE.md 雷 6，三個環境都要設）：
```bash
TOKEN=$(python3 -c "import json; print(json.load(open('/Users/hankuo/Library/Application Support/com.vercel.cli/auth.json'))['token'])")

for ENV in production preview development; do
  npx vercel env add GMAIL_USER $ENV --value "ok.oscar.kuo@gmail.com" --yes
  npx vercel env add GMAIL_APP_PASSWORD $ENV --value "<貼上 16 字元>" --yes
  npx vercel env add BACKUP_TO_EMAIL $ENV --value "ok.oscar.kuo@gmail.com" --yes
done
```

（或從 Vercel dashboard → Project Settings → Environment Variables 手動加。）

Expected：三個變數 × 三個環境 = 9 筆 env vars。

- [ ] **Step 4: （無 commit，純設定）**

`.env.local` 在 `.gitignore` 內不會被 commit。

---

## Task 13: 部署 + 驗證

**Files:**（無檔案修改）

- [ ] **Step 1: 確認 main 不落後**

Run:
```bash
git log main..HEAD --oneline | wc -l
```

> 依 CLAUDE.md 雷 8：若領先 main > 0，告知使用者「main 路線會讓那些 commits 暫時從 production 消失」，建議先 PR 合進 main。

- [ ] **Step 2: Push 觸發 Vercel preview**

Run:
```bash
git push -u origin HEAD
```

Expected：Vercel 自動 build 出 preview URL（在 GitHub PR 留言或 Vercel dashboard 看）。

- [ ] **Step 3: Preview 上手動測**

在 preview URL 開 `/more/backup`：
- [ ] 頁面正確顯示「下次寄送：2026-06-12」（雙週預設）
- [ ] 切「每月」→ 下次寄送變「2026-07-03」（7 月第一個週五）；再切回「每兩週」→ 回到「2026-06-12」
- [ ] 按「立即備份」→ 3 秒內收到 Gmail
- [ ] Excel 8 個分頁打開都有資料
- [ ] 立刻再按一次 → 顯示「3 分鐘內已備份過」
- [ ] 「上次寄送」更新成剛才的時間

- [ ] **Step 4: 合 main、部 production**

依 CLAUDE.md 流程：
1. 在 GitHub 開 PR
2. CI 通過後 merge
3. Vercel 自動部 production
4. 在 production 開 `/more/backup` 再按一次「立即備份」確認

- [ ] **Step 5: 等 2026-06-12 確認 cron 自動跑**

下週五（2026-06-12）UTC 14:00（Phoenix 07:00）應該自動收到一封備份信。
若沒收到：
```bash
npx vercel logs family-app-ruddy-one.vercel.app --limit 100 | grep -i backup
```

---

## Self-Review 紀錄

**Spec 覆蓋檢查**：
- 2.1 設定頁面 → Task 10 ✓
- 2.2 自動寄送流程 → Task 8 ✓
- 3.1 新檔案 11 項 → Task 2/3/4/5/6/7/8/9/10 覆蓋 ✓
- 3.2 改動檔案（vercel.json、more/page.tsx、.env.local、package.json）→ Task 1/11/12 ✓
- 3.3 新表 schema → Task 2 ✓
- 4.x Excel 內容 → Task 5 ✓
- 5.x 排程邏輯 → Task 3 ✓
- 5.4 並發保護（3 分鐘 cooldown）→ Task 7 ✓
- 6.x 寄信機制 → Task 6 ✓
- 7.x 錯誤處理（fallback JSON）→ Task 7 ✓
- 8.x 環境變數 → Task 12 ✓
- 9.x 部署檢查清單 → Task 13 ✓

**Placeholder 掃描**：無 TBD / TODO / 「實作細節」之類字眼。

**型別一致性**：`BackupConfig` 型別在 schedule.ts 定義並被 config-db / page / route 一致引用；`BackupSchedule` 同；`SendBackupArgs` 在 mailer.ts 定義並被 run-backup 引用。
