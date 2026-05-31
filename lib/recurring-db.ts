import { createAdminClient } from '@/lib/supabase/admin'

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type EndType = 'forever' | 'count'

export type RecurringTransaction = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  accountId: string
  targetAccountId: string | null
  targetAmount: number | null
  targetCurrency: string | null
  categoryId: string | null
  merchantId: string | null
  owner: 'Oscar' | 'Livia'
  frequency: Frequency
  startDate: string
  nextDueDate: string
  endType: EndType
  endCount: number | null
  generatedCount: number
  isActive: boolean
  notes: string | null
  accountName: string | null
  targetAccountName: string | null
  categoryName: string | null
  merchantName: string | null
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const originalDay = date.getDate()
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const day = Math.min(originalDay, lastDay)
  return new Date(targetYear, normalizedMonth, day, 12)
}

export function computeNextDueDate(currentDate: string, frequency: Frequency): string {
  const date = parseDate(currentDate)
  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7)
    return formatDate(date)
  }
  if (frequency === 'monthly') return formatDate(addMonthsClamped(date, 1))
  if (frequency === 'quarterly') return formatDate(addMonthsClamped(date, 3))
  return formatDate(addMonthsClamped(date, 12))
}

type RowJoined = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  account_id: string
  target_account_id: string | null
  target_amount: number | null
  target_currency: string | null
  category_id: string | null
  merchant_id: string | null
  owner: 'Oscar' | 'Livia'
  frequency: Frequency
  start_date: string
  next_due_date: string
  end_type: EndType
  end_count: number | null
  generated_count: number
  is_active: boolean
  notes: string | null
  family_accounts: { name: string } | null
  target_account: { name: string } | null
  family_categories: { name: string } | null
  family_merchants: { name: string } | null
}

function rowToRecurring(row: RowJoined): RecurringTransaction {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    amount: Number(row.amount),
    currency: row.currency,
    accountId: row.account_id,
    targetAccountId: row.target_account_id,
    targetAmount: row.target_amount === null ? null : Number(row.target_amount),
    targetCurrency: row.target_currency,
    categoryId: row.category_id,
    merchantId: row.merchant_id,
    owner: row.owner,
    frequency: row.frequency,
    startDate: row.start_date,
    nextDueDate: row.next_due_date,
    endType: row.end_type,
    endCount: row.end_count,
    generatedCount: row.generated_count,
    isActive: row.is_active,
    notes: row.notes,
    accountName: row.family_accounts?.name ?? null,
    targetAccountName: row.target_account?.name ?? null,
    categoryName: row.family_categories?.name ?? null,
    merchantName: row.family_merchants?.name ?? null,
  }
}

const SELECT_QUERY = `
  id, name, kind, amount, currency, account_id, target_account_id, target_amount,
  target_currency, category_id, merchant_id, owner, frequency, start_date,
  next_due_date, end_type, end_count, generated_count, is_active, notes,
  family_accounts!recurring_transactions_account_id_fkey ( name ),
  target_account:family_accounts!recurring_transactions_target_account_id_fkey ( name ),
  family_categories ( name ),
  family_merchants ( name )
`

export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(SELECT_QUERY)
    .order('is_active', { ascending: false })
    .order('next_due_date', { ascending: true })
  if (error) {
    console.error('getRecurringTransactions error:', error.message)
    return []
  }
  return ((data ?? []) as unknown as RowJoined[]).map(rowToRecurring)
}

export async function getRecurringTransactionById(id: string): Promise<RecurringTransaction | null> {
  const supabase = createAdminClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(SELECT_QUERY)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return rowToRecurring(data as unknown as RowJoined)
}

function todayInPhoenix(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export type GenerateResult = {
  generated: number
  templatesProcessed: number
  errors: string[]
}

export async function generateDueRecurringTransactions(): Promise<GenerateResult> {
  const supabase = createAdminClient()
  if (!supabase) return { generated: 0, templatesProcessed: 0, errors: ['no admin client'] }

  const today = todayInPhoenix()
  const errors: string[] = []
  let generated = 0
  let templatesProcessed = 0

  const { data: dueTemplates, error: queryErr } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('is_active', true)
    .lte('next_due_date', today)
  if (queryErr) return { generated: 0, templatesProcessed: 0, errors: [queryErr.message] }

  for (const tmpl of dueTemplates ?? []) {
    templatesProcessed++
    let nextDue: string = tmpl.next_due_date
    let generatedCount = tmpl.generated_count
    let isActive = true

    while (nextDue <= today && isActive) {
      const occurredAtIso = new Date(`${nextDue}T12:00:00`).toISOString()
      const insertRow: Record<string, unknown> = {
        kind: tmpl.kind,
        title: tmpl.name,
        amount: tmpl.amount,
        currency: tmpl.currency,
        account_id: tmpl.account_id,
        to_account_id: tmpl.target_account_id,
        transfer_target_amount: tmpl.target_amount,
        transfer_target_currency: tmpl.target_currency,
        category_id: tmpl.category_id,
        merchant_id: tmpl.merchant_id,
        owner: tmpl.owner,
        occurred_on: nextDue,
        occurred_at: occurredAtIso,
        note: tmpl.notes,
        recurring_id: tmpl.id,
      }

      const { error: insertErr } = await supabase.from('family_transactions').insert(insertRow)
      if (insertErr) {
        errors.push(`template ${tmpl.id} insert failed: ${insertErr.message}`)
        break
      }
      generated++
      generatedCount++

      if (tmpl.end_type === 'count' && tmpl.end_count !== null && generatedCount >= tmpl.end_count) {
        isActive = false
        break
      }
      nextDue = computeNextDueDate(nextDue, tmpl.frequency)
    }

    const { error: updateErr } = await supabase
      .from('recurring_transactions')
      .update({
        next_due_date: nextDue,
        generated_count: generatedCount,
        is_active: isActive,
      })
      .eq('id', tmpl.id)
    if (updateErr) errors.push(`template ${tmpl.id} update failed: ${updateErr.message}`)
  }

  return { generated, templatesProcessed, errors }
}
