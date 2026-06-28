import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type ReminderFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type ReminderItem = {
  id: string
  name: string
  detail: string | null
  category: string | null
  dueOn: string | null
  frequency: ReminderFrequency
  accountId: string | null
  accountName: string | null
  completedAt: string | null
  isPaused: boolean
}

export type ReminderGroup = {
  category: string
  items: ReminderItem[]
}

export type MaintenanceFormItem = Pick<
  ReminderItem,
  'id' | 'name' | 'category' | 'frequency' | 'accountId' | 'accountName' | 'dueOn'
>

export type MaintenanceRecord = {
  id: string
  type: 'maintenance'
  reminderId: string
  name: string
  category: string | null
  frequency: ReminderFrequency
  accountId: string | null
  accountName: string | null
  note: string | null
  completedOn: string
  occurred_on: string
  created_at: string
}

const CATEGORY_ORDER = ['車子', '房屋', '帳單', '家事', '其他']

let reminderPausedColumnSupported: boolean | null = null
let maintenanceRecordsTableSupported: boolean | null = null

function isReminderFrequency(value: string): value is ReminderFrequency {
  return value === 'once'
    || value === 'weekly'
    || value === 'monthly'
    || value === 'quarterly'
    || value === 'yearly'
}

async function supportsReminderPausedColumn() {
  if (reminderPausedColumnSupported !== null) return reminderPausedColumnSupported

  const supabase = createAdminClient()
  if (!supabase) {
    reminderPausedColumnSupported = false
    return reminderPausedColumnSupported
  }

  const { error } = await supabase.from('maintenance_reminders').select('is_paused').limit(1)
  reminderPausedColumnSupported = !(error && (error.code === '42703' || error.code === 'PGRST204'))
  return reminderPausedColumnSupported
}

async function supportsMaintenanceRecordsTable() {
  if (maintenanceRecordsTableSupported !== null) return maintenanceRecordsTableSupported

  const supabase = createAdminClient()
  if (!supabase) {
    maintenanceRecordsTableSupported = false
    return maintenanceRecordsTableSupported
  }

  const { error } = await supabase.from('maintenance_records').select('id').limit(1)
  maintenanceRecordsTableSupported = !(error && (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST116'
  ))
  return maintenanceRecordsTableSupported
}

async function getAccountNameMap(accountIds: string[]) {
  const supabase = createAdminClient()
  if (!supabase || accountIds.length === 0) return new Map<string, string>()

  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, name')
    .in('id', accountIds)

  if (error) {
    console.error('getAccountNameMap error:', error.message)
    return new Map<string, string>()
  }

  return new Map((data ?? []).map((row) => [row.id as string, row.name as string]))
}

type ReminderRow = {
  id: string
  name: string
  detail: string | null
  category: string | null
  due_on: string | null
  frequency: string
  account_id: string | null
  completed_at: string | null
  is_paused?: boolean | null
}

async function getReminderRows(): Promise<ReminderRow[]> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return []

  const supabase = createAdminClient()
  if (!supabase) return []

  const supportsPaused = await supportsReminderPausedColumn()
  const selectColumns = [
    'id',
    'name',
    'detail',
    'category',
    'due_on',
    'frequency',
    'account_id',
    'completed_at',
    supportsPaused ? 'is_paused' : null,
  ]
    .filter(Boolean)
    .join(', ')

  const { data, error } = await supabase
    .from('maintenance_reminders')
    .select(selectColumns)
    .is('completed_at', null)
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getReminderRows error:', error.message)
    return []
  }

  return (data ?? []) as unknown as ReminderRow[]
}

export async function getReminders(): Promise<ReminderItem[]> {
  const rows = await getReminderRows()
  const accountIds = rows.flatMap((row) => (row.account_id ? [row.account_id] : []))
  const accountNames = await getAccountNameMap(accountIds)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    detail: row.detail ?? null,
    category: row.category ?? null,
    dueOn: row.due_on ?? null,
    frequency: isReminderFrequency(row.frequency) ? row.frequency : 'quarterly',
    accountId: row.account_id ?? null,
    accountName: row.account_id ? accountNames.get(row.account_id) ?? null : null,
    completedAt: row.completed_at ?? null,
    isPaused: Boolean(row.is_paused),
  }))
}

export async function getMaintenanceItemsForForm(): Promise<MaintenanceFormItem[]> {
  const reminders = await getReminders()

  return reminders
    .filter((item) => !item.isPaused)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      frequency: item.frequency,
      accountId: item.accountId,
      accountName: item.accountName,
      dueOn: item.dueOn,
    }))
}

type MaintenanceRecordRow = {
  id: string
  reminder_id: string
  completed_on: string
  note: string | null
  created_at: string
}

export async function getMaintenanceRecords(params?: {
  startDate?: string
  endDate?: string
  accountId?: string
  query?: string
}): Promise<MaintenanceRecord[]> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return []

  if (!(await supportsMaintenanceRecordsTable())) return []

  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from('maintenance_records')
    .select('id, reminder_id, completed_on, note, created_at')
    .order('completed_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (params?.startDate) query = query.gte('completed_on', params.startDate)
  if (params?.endDate) query = query.lte('completed_on', params.endDate)

  const { data, error } = await query
  if (error) {
    console.error('getMaintenanceRecords error:', error.message)
    return []
  }

  const rows = (data ?? []) as MaintenanceRecordRow[]
  if (rows.length === 0) return []

  const reminderIds = [...new Set(rows.map((row) => row.reminder_id))]
  const { data: reminderRows, error: reminderError } = await supabase
    .from('maintenance_reminders')
    .select('id, name, category, frequency, account_id')
    .in('id', reminderIds)

  if (reminderError) {
    console.error('getMaintenanceRecords reminder fetch error:', reminderError.message)
    return []
  }

  const reminderMap = new Map(
    (reminderRows ?? []).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        name: row.name as string,
        category: (row.category as string | null) ?? null,
        frequency: isReminderFrequency(row.frequency as string) ? row.frequency as ReminderFrequency : 'quarterly',
        accountId: (row.account_id as string | null) ?? null,
      },
    ]),
  )

  const accountIds = [...new Set(
    [...reminderMap.values()].flatMap((row) => (row.accountId ? [row.accountId] : [])),
  )]
  const accountNames = await getAccountNameMap(accountIds)
  const queryText = params?.query?.trim().toLocaleLowerCase('zh-TW') ?? ''

  return rows
    .flatMap((row) => {
      const reminder = reminderMap.get(row.reminder_id)
      if (!reminder) return []

      const record: MaintenanceRecord = {
        id: row.id,
        type: 'maintenance',
        reminderId: reminder.id,
        name: reminder.name,
        category: reminder.category,
        frequency: reminder.frequency,
        accountId: reminder.accountId,
        accountName: reminder.accountId ? accountNames.get(reminder.accountId) ?? null : null,
        note: row.note ?? null,
        completedOn: row.completed_on,
        occurred_on: row.completed_on,
        created_at: row.created_at,
      }

      if (params?.accountId && record.accountId !== params.accountId) return []

      if (queryText) {
        const haystack = [
          record.name,
          record.category,
          record.accountName,
          record.note,
        ]
          .map((value) => String(value ?? '').toLocaleLowerCase('zh-TW'))
          .join('|')

        if (!haystack.includes(queryText)) return []
      }

      return [record]
    })
}

export function groupRemindersByCategory(reminders: ReminderItem[]): ReminderGroup[] {
  const map = new Map<string, ReminderItem[]>()

  for (const reminder of reminders) {
    const cat = reminder.category ?? '其他'
    const group = map.get(cat) ?? []
    group.push(reminder)
    map.set(cat, group)
  }

  const result: ReminderGroup[] = []
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat)
    if (items?.length) result.push({ category: cat, items })
  }

  for (const [cat, items] of map.entries()) {
    if (!CATEGORY_ORDER.includes(cat) && items.length) {
      result.push({ category: cat, items })
    }
  }

  return result
}
