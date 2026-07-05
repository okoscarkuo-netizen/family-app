'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DATA_CACHE_TAGS } from '@/lib/data-cache'
import { ensureDefaultHouseholdId } from '@/lib/household'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>
type ReminderFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export type CreateMaintenanceReminderResult =
  | { ok: true }
  | { ok: false; error: string }

export type SaveMaintenanceRecordResult =
  | { ok: true }
  | { ok: false; error: string }

export type CompleteReminderResult =
  | { ok: true }
  | { ok: false; error: string }

export type ReminderMutationResult =
  | { ok: true }
  | { ok: false; error: string }

type ParsedReminderDraftFields = {
  name: string
  category: string | null
  frequency: ReminderFrequency
  dueOn: string | null
  detail: string | null
  accountId: string | null
}

type MaintenanceRecordRow = {
  id: string
  reminder_id: string
  completed_on: string
  note: string | null
  created_at: string
}

const VALID_FREQUENCIES = new Set<ReminderFrequency>([
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
])

const VALID_CATEGORIES = new Set([
  '車子', '房屋', '帳單', '家事', '其他',
])

let householdIdColumnSupported: boolean | null = null
let createdByColumnSupported: boolean | null = null
let pausedColumnSupported: boolean | null = null
let maintenanceRecordsTableSupported: boolean | null = null

async function probeReminderColumn(supabase: AdminClient, column: string): Promise<boolean> {
  const { error } = await supabase.from('maintenance_reminders').select(column).limit(1)
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') return false
    throw new Error(error.message)
  }
  return true
}

async function supportsHouseholdIdColumn(supabase: AdminClient): Promise<boolean> {
  if (householdIdColumnSupported !== null) return householdIdColumnSupported
  householdIdColumnSupported = await probeReminderColumn(supabase, 'household_id')
  return householdIdColumnSupported
}

async function supportsCreatedByColumn(supabase: AdminClient): Promise<boolean> {
  if (createdByColumnSupported !== null) return createdByColumnSupported
  createdByColumnSupported = await probeReminderColumn(supabase, 'created_by')
  return createdByColumnSupported
}

async function supportsPausedColumn(supabase: AdminClient): Promise<boolean> {
  if (pausedColumnSupported !== null) return pausedColumnSupported
  pausedColumnSupported = await probeReminderColumn(supabase, 'is_paused')
  return pausedColumnSupported
}

async function supportsMaintenanceRecordsTable(supabase: AdminClient): Promise<boolean> {
  if (maintenanceRecordsTableSupported !== null) return maintenanceRecordsTableSupported

  const { error } = await supabase.from('maintenance_records').select('id').limit(1)
  maintenanceRecordsTableSupported = !(error && (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST116'
  ))
  return maintenanceRecordsTableSupported
}

function str(val: FormDataEntryValue | null): string {
  return val ? String(val).trim() : ''
}

function nullableStr(val: FormDataEntryValue | null): string | null {
  const value = str(val)
  return value === '' ? null : value
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function formatDateUtc(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDateUtc(date)
}

function addMonths(value: string, months: number) {
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const day = Number(dayRaw)

  const nextMonth = new Date(Date.UTC(year, monthIndex + months, 1))
  const lastDay = new Date(Date.UTC(
    nextMonth.getUTCFullYear(),
    nextMonth.getUTCMonth() + 1,
    0,
  )).getUTCDate()
  nextMonth.setUTCDate(Math.min(day, lastDay))

  return formatDateUtc(nextMonth)
}

function nextDueOn(frequency: ReminderFrequency, from: string): string | null {
  if (frequency === 'weekly') return addDays(from, 7)
  if (frequency === 'monthly') return addMonths(from, 1)
  if (frequency === 'quarterly') return addMonths(from, 3)
  if (frequency === 'semiannual') return addMonths(from, 6)
  if (frequency === 'yearly') return addMonths(from, 12)
  return null
}

function todayDateString() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value ?? String(now.getUTCFullYear())
  const month = parts.find((part) => part.type === 'month')?.value ?? String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = parts.find((part) => part.type === 'day')?.value ?? String(now.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function parseReminderDraftFields(
  supabase: AdminClient,
  formData: FormData,
): Promise<{ ok: true; fields: ParsedReminderDraftFields } | { ok: false; error: string }> {
  const name = str(formData.get('name'))
  if (!name) return fail('項目名稱必填。')

  const category = nullableStr(formData.get('category'))
  if (category && !VALID_CATEGORIES.has(category)) return fail('類別設定不正確。')

  const frequency = str(formData.get('frequency')) as ReminderFrequency
  if (!VALID_FREQUENCIES.has(frequency)) return fail('週期設定不正確。')

  const dueOn = nullableStr(formData.get('due_on'))
  if (dueOn && !isValidDate(dueOn)) return fail('下次日期格式不正確。')

  const detail = nullableStr(formData.get('detail'))
  const accountId = nullableStr(formData.get('account_id'))
  if (accountId) {
    const account = await validateAccount(supabase, accountId)
    if (!account) return fail('找不到該帳戶，請重新選擇。')
  }

  return {
    ok: true,
    fields: {
      name,
      category,
      frequency,
      dueOn,
      detail,
      accountId,
    },
  }
}

async function getCurrentUser() {
  const authClient = await createClient()
  const { data, error } = await authClient.auth.getUser()
  if (error) throw new Error(error.message)
  if (!data.user) return null
  return data.user
}

async function validateAccount(supabase: AdminClient, accountId: string) {
  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, is_archived')
    .eq('id', accountId)
    .maybeSingle()

  if (error) return null
  if (!data || data.is_archived) return null
  return data
}

async function ensureMutationSupport(supabase: AdminClient) {
  let supportsHouseholdId: boolean
  let supportsCreatedBy: boolean
  let supportsPaused: boolean
  let supportsRecords: boolean

  try {
    [supportsHouseholdId, supportsCreatedBy, supportsPaused, supportsRecords] = await Promise.all([
      supportsHouseholdIdColumn(supabase),
      supportsCreatedByColumn(supabase),
      supportsPausedColumn(supabase),
      supportsMaintenanceRecordsTable(supabase),
    ])
  } catch (error) {
    console.error('probe reminder columns error:', error)
    return fail('資料庫連線目前不可用，請稍後再試。')
  }

  if (!supportsRecords) {
    return fail('保養歷史資料表還沒建立，請先套用 migration。')
  }

  return {
    ok: true as const,
    supportsHouseholdId,
    supportsCreatedBy,
    supportsPaused,
  }
}

async function createMaintenanceItem(
  supabase: AdminClient,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  payload: {
    name: string
    category: string | null
    frequency: ReminderFrequency
    dueOn: string | null
    detail: string | null
    accountId: string | null
    completedAt: string | null
  },
) {
  const support = await ensureMutationSupport(supabase)
  if (!support.ok) return support

  let householdId: string
  try {
    householdId = await ensureDefaultHouseholdId(supabase, user)
  } catch (error) {
    console.error('ensure default household for maintenance item failed:', error)
    return fail('目前無法取得家庭資料，請稍後再試。')
  }

  const insertPayload: Record<string, string | null | boolean> = {
    account_id: payload.accountId,
    name: payload.name,
    category: payload.category,
    detail: payload.detail,
    due_on: payload.dueOn,
    frequency: payload.frequency,
    completed_at: payload.completedAt,
  }

  if (support.supportsPaused) {
    insertPayload.is_paused = false
  }

  if (support.supportsHouseholdId) {
    insertPayload.household_id = householdId
  }

  if (support.supportsCreatedBy) {
    insertPayload.created_by = user.id
  }

  const selectColumns = [
    'id',
    support.supportsHouseholdId ? 'household_id' : null,
    'frequency',
  ]
    .filter(Boolean)
    .join(', ')

  const { data, error } = await supabase
    .from('maintenance_reminders')
    .insert(insertPayload)
    .select(selectColumns)
    .single()

  if (error || !data) {
    return fail(error?.message ?? '保養項目建立失敗。')
  }

  const inserted = data as unknown as Record<string, unknown>

  return {
    ok: true as const,
    reminder: {
      id: inserted.id as string,
      householdId: support.supportsHouseholdId
        ? String(inserted.household_id ?? householdId)
        : householdId,
      frequency: inserted.frequency as ReminderFrequency,
    },
  }
}

export async function createMaintenanceReminder(
  formData: FormData,
): Promise<CreateMaintenanceReminderResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入再新增保養項目。')

  const parsed = await parseReminderDraftFields(supabase, formData)
  if (!parsed.ok) return parsed

  const result = await createMaintenanceItem(supabase, user, {
    name: parsed.fields.name,
    category: parsed.fields.category,
    frequency: parsed.fields.frequency,
    dueOn: parsed.fields.dueOn,
    detail: parsed.fields.detail,
    accountId: parsed.fields.accountId,
    completedAt: null,
  })

  if (!result.ok) return result

  revalidateMaintenanceViews()
  return { ok: true }
}

async function resolveReminderForRecord(
  supabase: AdminClient,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  formData: FormData,
  completedOn: string,
) {
  const reminderId = str(formData.get('reminder_id'))
  if (reminderId) {
    const support = await ensureMutationSupport(supabase)
    if (!support.ok) return support

    let fallbackHouseholdId: string
    try {
      fallbackHouseholdId = await ensureDefaultHouseholdId(supabase, user)
    } catch (error) {
      console.error('ensure default household for maintenance record failed:', error)
      return fail('目前無法取得家庭資料，請稍後再試。')
    }

    const selectColumns = [
      'id',
      support.supportsHouseholdId ? 'household_id' : null,
      'frequency',
      'account_id',
      'completed_at',
      support.supportsPaused ? 'is_paused' : null,
    ]
      .filter(Boolean)
      .join(', ')

    const { data, error } = await supabase
      .from('maintenance_reminders')
      .select(selectColumns)
      .eq('id', reminderId)
      .maybeSingle()

    if (error || !data) return fail('找不到該保養項目。')
    const row = data as unknown as Record<string, unknown>
    if (row.completed_at) return fail('這個保養項目已經結束。')
    if (support.supportsPaused && row.is_paused) return fail('這個保養項目目前已暫停。')

    const householdId = support.supportsHouseholdId
      ? String(row.household_id ?? fallbackHouseholdId)
      : fallbackHouseholdId

    return {
      ok: true as const,
      reminder: {
        id: row.id as string,
        householdId,
        frequency: row.frequency as ReminderFrequency,
      },
      supportsPaused: support.supportsPaused,
    }
  }

  const name = str(formData.get('name'))
  if (!name) return fail('項目名稱必填。')

  const category = nullableStr(formData.get('category'))
  if (category && !VALID_CATEGORIES.has(category)) return fail('類別設定不正確。')

  const frequency = str(formData.get('frequency')) as ReminderFrequency
  if (!VALID_FREQUENCIES.has(frequency)) return fail('週期設定不正確。')

  const accountId = nullableStr(formData.get('account_id'))
  if (accountId) {
    const account = await validateAccount(supabase, accountId)
    if (!account) return fail('找不到該帳戶，請重新選擇。')
  }

  const created = await createMaintenanceItem(supabase, user, {
    name,
    category,
    frequency,
    dueOn: nextDueOn(frequency, completedOn),
    detail: nullableStr(formData.get('detail')),
    accountId,
    completedAt: frequency === 'once' ? new Date().toISOString() : null,
  })

  if (!created.ok) return created

  return {
    ok: true as const,
    reminder: created.reminder,
    supportsPaused: true,
  }
}

function revalidateMaintenanceViews() {
  revalidateTag(DATA_CACHE_TAGS.reminders, 'max')
  revalidatePath('/')
  revalidatePath('/ledger')
  revalidatePath('/ledger/new')
  revalidatePath('/more')
  revalidatePath('/reminders')
}

function revalidateMaintenanceDetailPaths(reminderId: string, recordId?: string) {
  revalidateMaintenanceViews()
  revalidatePath(`/reminders/${encodeURIComponent(reminderId)}`)
  if (recordId) {
    revalidatePath(`/reminders/records/${encodeURIComponent(recordId)}`)
  }
}

async function syncReminderAfterRecordMutation(
  supabase: AdminClient,
  reminderId: string,
  fallbackDueOn: string | null,
) {
  const support = await ensureMutationSupport(supabase)
  if (!support.ok) return support

  const selectColumns = [
    'id',
    'frequency',
    'completed_at',
  ]
    .filter(Boolean)
    .join(', ')

  const { data: reminderRow, error: reminderError } = await supabase
    .from('maintenance_reminders')
    .select(selectColumns)
    .eq('id', reminderId)
    .maybeSingle()

  if (reminderError || !reminderRow) return fail('找不到對應的保養項目。')

  const { data: latestRow, error: latestError } = await supabase
    .from('maintenance_records')
    .select('id, reminder_id, completed_on, note, created_at')
    .eq('reminder_id', reminderId)
    .order('completed_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError && latestError.code !== 'PGRST116') {
    return fail(latestError.message)
  }

  const reminder = reminderRow as unknown as Record<string, unknown>
  const latest = latestRow as MaintenanceRecordRow | null
  const frequency = reminder.frequency as ReminderFrequency

  const updatePayload: Record<string, string | null> = latest
    ? {
        due_on: nextDueOn(frequency, latest.completed_on),
        completed_at: frequency === 'once'
          ? String(reminder.completed_at ?? latest.created_at ?? new Date().toISOString())
          : null,
      }
    : {
        due_on: fallbackDueOn,
        completed_at: null,
      }

  const { error: updateError } = await supabase
    .from('maintenance_reminders')
    .update(updatePayload)
    .eq('id', reminderId)

  if (updateError) return fail(updateError.message)
  return { ok: true as const }
}

export async function saveMaintenanceRecord(
  formData: FormData,
): Promise<SaveMaintenanceRecordResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入。')

  const completedOn = str(formData.get('completed_on'))
  if (!isValidDate(completedOn)) return fail('完成日期必填。')

  const note = nullableStr(formData.get('note'))
  const resolved = await resolveReminderForRecord(supabase, user, formData, completedOn)
  if (!resolved.ok) return resolved

  const support = await ensureMutationSupport(supabase)
  if (!support.ok) return support

  const { error: recordError } = await supabase
    .from('maintenance_records')
    .insert({
      household_id: resolved.reminder.householdId,
      reminder_id: resolved.reminder.id,
      created_by: user.id,
      completed_on: completedOn,
      note,
    })

  if (recordError) return fail(recordError.message)

  const nextDue = nextDueOn(resolved.reminder.frequency, completedOn)
  const updatePayload: Record<string, string | null | boolean> = {
    due_on: nextDue,
    completed_at: resolved.reminder.frequency === 'once' ? new Date().toISOString() : null,
  }

  if (support.supportsPaused) {
    updatePayload.is_paused = false
  }

  const { error: updateError } = await supabase
    .from('maintenance_reminders')
    .update(updatePayload)
    .eq('id', resolved.reminder.id)

  if (updateError) return fail(updateError.message)

  revalidateMaintenanceViews()
  return { ok: true }
}

export async function completeReminder(
  formData: FormData,
): Promise<CompleteReminderResult> {
  const reminderId = str(formData.get('reminder_id'))
  if (!reminderId) return fail('找不到保養項目 ID。')

  const completedOn = str(formData.get('completed_on')) || todayDateString()
  const payload = new FormData()
  payload.set('reminder_id', reminderId)
  payload.set('completed_on', completedOn)

  return saveMaintenanceRecord(payload)
}

export async function setReminderPaused(
  formData: FormData,
): Promise<ReminderMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入。')

  const reminderId = str(formData.get('reminder_id'))
  if (!reminderId) return fail('找不到保養項目 ID。')

  const paused = str(formData.get('paused')) === 'true'
  const support = await ensureMutationSupport(supabase)
  if (!support.ok) return support
  if (!support.supportsPaused) return fail('目前資料庫還不支援暫停功能。')

  const { error } = await supabase
    .from('maintenance_reminders')
    .update({ is_paused: paused })
    .eq('id', reminderId)

  if (error) return fail(error.message)

  revalidateMaintenanceViews()
  return { ok: true }
}

export async function updateReminder(
  formData: FormData,
): Promise<ReminderMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入。')

  const reminderId = str(formData.get('reminder_id'))
  if (!reminderId) return fail('找不到保養項目 ID。')

  const parsed = await parseReminderDraftFields(supabase, formData)
  if (!parsed.ok) return parsed

  const { data, error } = await supabase
    .from('maintenance_reminders')
    .select('id, completed_at')
    .eq('id', reminderId)
    .maybeSingle()

  if (error || !data) return fail('找不到該保養項目。')
  if (data.completed_at) return fail('這個保養項目已經結束。')

  const { error: updateError } = await supabase
    .from('maintenance_reminders')
    .update({
      account_id: parsed.fields.accountId,
      category: parsed.fields.category,
      detail: parsed.fields.detail,
      due_on: parsed.fields.dueOn,
      frequency: parsed.fields.frequency,
      name: parsed.fields.name,
    })
    .eq('id', reminderId)

  if (updateError) return fail(updateError.message)

  revalidateMaintenanceViews()
  return { ok: true }
}

export async function updateMaintenanceRecord(
  recordId: string,
  formData: FormData,
): Promise<ReminderMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入。')

  const completedOn = str(formData.get('completed_on'))
  if (!isValidDate(completedOn)) return fail('完成日期必填。')
  const note = nullableStr(formData.get('note'))

  const { data: existing, error: existingError } = await supabase
    .from('maintenance_records')
    .select('id, reminder_id, completed_on')
    .eq('id', recordId)
    .maybeSingle()

  if (existingError || !existing) return fail('找不到這筆保養紀錄。')

  const reminderId = String(existing.reminder_id)

  const { error: updateError } = await supabase
    .from('maintenance_records')
    .update({
      completed_on: completedOn,
      note,
    })
    .eq('id', recordId)

  if (updateError) return fail(updateError.message)

  const syncResult = await syncReminderAfterRecordMutation(supabase, reminderId, completedOn)
  if (!syncResult.ok) return syncResult

  revalidateMaintenanceDetailPaths(reminderId, recordId)
  return { ok: true }
}

export async function deleteMaintenanceRecord(recordId: string): Promise<ReminderMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入。')

  const { data: existing, error: existingError } = await supabase
    .from('maintenance_records')
    .select('id, reminder_id, completed_on')
    .eq('id', recordId)
    .maybeSingle()

  if (existingError || !existing) return fail('找不到這筆保養紀錄。')

  const reminderId = String(existing.reminder_id)
  const fallbackDueOn = String(existing.completed_on ?? '') || null

  const { error: deleteError } = await supabase
    .from('maintenance_records')
    .delete()
    .eq('id', recordId)

  if (deleteError) return fail(deleteError.message)

  const syncResult = await syncReminderAfterRecordMutation(supabase, reminderId, fallbackDueOn)
  if (!syncResult.ok) return syncResult

  revalidateMaintenanceDetailPaths(reminderId, recordId)
  return { ok: true }
}

export async function deleteReminder(
  formData: FormData,
): Promise<ReminderMutationResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入。')

  const reminderId = str(formData.get('reminder_id'))
  if (!reminderId) return fail('找不到保養項目 ID。')

  const { error } = await supabase
    .from('maintenance_reminders')
    .delete()
    .eq('id', reminderId)

  if (error) return fail(error.message)

  revalidateMaintenanceViews()
  return { ok: true }
}
