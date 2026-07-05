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

  // 先抓會被當 lookup 的表
  const [accountsRes, categoriesRes, merchantsRes, merchantGroupsRes] = await Promise.all([
    admin.from('family_accounts').select('*').order('sort_order'),
    admin.from('family_categories').select('*').order('sort_order'),
    admin.from('family_merchants').select('*').order('name'),
    admin.from('family_merchant_groups').select('*').order('sort_order'),
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

  // 再抓主資料表
  const sinceYmd = new Date(today.getTime() - 365 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const [transactionsRes, recurringRes, remindersRes, ratesRes] = await Promise.all([
    admin
      .from('family_transactions')
      .select('*')
      .order('occurred_on', { ascending: false }),
    admin
      .from('recurring_transactions')
      .select('*')
      .order('next_due_date'),
    admin.from('maintenance_reminders').select('*').order('due_on'),
    admin
      .from('exchange_rate_snapshots')
      .select('*')
      .gte('snapshot_date', sinceYmd)
      .order('snapshot_date', { ascending: false }),
  ])
  for (const r of [transactionsRes, recurringRes, remindersRes, ratesRes]) {
    if (r.error) throw new Error(`fetch failed: ${r.error.message}`)
  }
  const transactions = transactionsRes.data ?? []
  const recurring = recurringRes.data ?? []
  const reminders = remindersRes.data ?? []
  const rates = ratesRes.data ?? []

  // 建 workbook
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Family App'
  wb.created = new Date()

  // Sheet 1: 帳戶
  const sAcc = wb.addWorksheet('帳戶')
  styleHeader(sAcc, [
    '帳戶ID', '名稱', '類型', '資產/負債', '擁有者', '幣別',
    '目前餘額', '期初餘額', '開帳日', '備註', '隱藏', '常用', '共用', '順序',
  ])
  for (const a of accounts as Record<string, unknown>[]) {
    sAcc.addRow([
      a.id,
      a.name,
      a.type,
      a.kind,
      a.owner,
      a.currency,
      a.balance ?? 0,
      a.opening_balance ?? 0,
      fmtDate(a.balance_date as string | null),
      a.remark ?? '',
      a.hidden ? 'Y' : '',
      a.favorite ? 'Y' : '',
      a.shared ? 'Y' : '',
      a.sort_order ?? 0,
    ])
  }

  // Sheet 2: 交易
  const sTxn = wb.addWorksheet('交易')
  styleHeader(sTxn, [
    '交易ID', '日期', '時間', '類型', '標題', '金額', '幣別',
    '帳戶ID', '帳戶名稱', '對方帳戶ID', '對方帳戶名稱',
    '分類ID', '分類名稱', '商家ID', '商家名稱', '商家(舊欄位)',
    '擁有者', '備註', '轉帳目標金額', '轉帳目標幣別',
  ])
  for (const t of transactions as Record<string, unknown>[]) {
    const accId = (t.account_id as string | null) ?? null
    const toAccId = (t.to_account_id as string | null) ?? null
    const catId = (t.category_id as string | null) ?? null
    const merId = (t.merchant_id as string | null) ?? null
    sTxn.addRow([
      t.id,
      fmtDate(t.occurred_on as string | null),
      fmtDate(t.occurred_at as string | null),
      t.kind,
      t.title ?? '',
      t.amount ?? 0,
      t.currency,
      accId,
      accId ? accountName.get(accId) ?? '' : '',
      toAccId,
      toAccId ? accountName.get(toAccId) ?? '' : '',
      catId,
      catId ? categoryName.get(catId) ?? '' : '',
      merId,
      merId ? merchantName.get(merId) ?? '' : '',
      t.merchant ?? '',
      t.owner,
      t.note ?? '',
      t.transfer_target_amount ?? '',
      t.transfer_target_currency ?? '',
    ])
  }

  // Sheet 3: 週期交易
  const sRec = wb.addWorksheet('週期交易')
  styleHeader(sRec, [
    '週期ID', '名稱', '類型', '金額', '幣別', '帳戶ID', '帳戶名稱',
    '對方帳戶ID', '對方帳戶名稱', '分類ID', '分類名稱', '商家ID', '商家名稱',
    '擁有者', '頻率', '起始日', '下次執行日', '結束類型', '結束次數',
    '已產生次數', '已停用', '備註',
  ])
  for (const r of recurring as Record<string, unknown>[]) {
    const accId = (r.account_id as string | null) ?? null
    const tgtAccId = (r.target_account_id as string | null) ?? null
    const catId = (r.category_id as string | null) ?? null
    const merId = (r.merchant_id as string | null) ?? null
    sRec.addRow([
      r.id,
      r.name,
      r.kind,
      r.amount ?? 0,
      r.currency,
      accId,
      accId ? accountName.get(accId) ?? '' : '',
      tgtAccId,
      tgtAccId ? accountName.get(tgtAccId) ?? '' : '',
      catId,
      catId ? categoryName.get(catId) ?? '' : '',
      merId,
      merId ? merchantName.get(merId) ?? '' : '',
      r.owner,
      r.frequency,
      fmtDate(r.start_date as string | null),
      fmtDate(r.next_due_date as string | null),
      r.end_type,
      r.end_count ?? '',
      r.generated_count ?? 0,
      r.is_active === false ? 'Y' : '',
      r.notes ?? '',
    ])
  }

  // Sheet 4: 分類
  const sCat = wb.addWorksheet('分類')
  styleHeader(sCat, [
    '分類ID', '名稱', '父分類ID', '父分類名稱', '類型', '圖示', '色票', '順序', '已封存',
  ])
  for (const c of categories as Record<string, unknown>[]) {
    const parentId = (c.parent_id as string | null) ?? null
    sCat.addRow([
      c.id,
      c.name,
      parentId,
      parentId ? categoryName.get(parentId) ?? '' : '',
      c.kind,
      c.icon ?? '',
      c.color ?? '',
      c.sort_order ?? 0,
      c.is_archived ? 'Y' : '',
    ])
  }

  // Sheet 5: 商家
  const sMer = wb.addWorksheet('商家')
  styleHeader(sMer, [
    '商家ID', '名稱', '正規化名稱', '群組ID', '群組名稱', '最後使用時間', '已封存',
  ])
  for (const m of merchants as Record<string, unknown>[]) {
    const groupId = (m.group_id as string | null) ?? null
    sMer.addRow([
      m.id,
      m.name,
      m.normalized_name ?? '',
      groupId,
      groupId ? merchantGroupName.get(groupId) ?? '' : '',
      fmtDate(m.last_used_at as string | null),
      m.is_archived ? 'Y' : '',
    ])
  }

  // Sheet 6: 商家群組
  const sGrp = wb.addWorksheet('商家群組')
  styleHeader(sGrp, ['群組ID', '名稱', '順序', '已封存'])
  for (const g of merchantGroups as Record<string, unknown>[]) {
    sGrp.addRow([
      g.id,
      g.name,
      g.sort_order ?? 0,
      g.is_archived ? 'Y' : '',
    ])
  }

  // Sheet 7: 提醒事項
  const sRem = wb.addWorksheet('提醒事項')
  styleHeader(sRem, [
    '提醒ID', '名稱', '說明', '帳戶ID', '帳戶名稱', '到期日',
    '里程到期', '頻率', '分類', '已完成時間',
  ])
  for (const r of reminders as Record<string, unknown>[]) {
    const accId = (r.account_id as string | null) ?? null
    sRem.addRow([
      r.id,
      r.name,
      r.detail ?? '',
      accId,
      accId ? accountName.get(accId) ?? '' : '',
      fmtDate(r.due_on as string | null),
      r.mileage_due ?? '',
      r.frequency ?? '',
      r.category ?? '',
      fmtDate(r.completed_at as string | null),
    ])
  }

  // Sheet 8: 匯率快照（每日一筆 JSONB）
  const sRate = wb.addWorksheet('匯率快照')
  styleHeader(sRate, ['日期', '來源', '原始日期', '匯率(JSON)', '檢查時間'])
  for (const r of rates as Record<string, unknown>[]) {
    const ratesBlob = r.rates as unknown
    sRate.addRow([
      fmtDate(r.snapshot_date as string | null),
      r.source ?? '',
      fmtDate(r.source_date as string | null),
      JSON.stringify(ratesBlob ?? {}),
      fmtDate(r.checked_at as string | null),
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
