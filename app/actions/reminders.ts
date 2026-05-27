'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureDefaultHouseholdId } from '@/lib/household'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>
type ReminderFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type CreateMaintenanceReminderResult =
  | { ok: true }
  | { ok: false; error: string }

export type CompleteReminderResult =
  | { ok: true }
  | { ok: false; error: string }

const VALID_FREQUENCIES = new Set<ReminderFrequency>([
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
])

const VALID_CATEGORIES = new Set([
  '車子', '房屋', '帳單', '家事', '其他',
])

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

function nextDueOn(frequency: ReminderFrequency, from: Date): string {
  const d = new Date(from)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') { d.setDate(1); d.setMonth(d.getMonth() + 1) }
  else if (frequency === 'quarterly') { d.setDate(1); d.setMonth(d.getMonth() + 3) }
  else if (frequency === 'yearly') { d.setDate(1); d.setMonth(d.getMonth() + 12) }
  else return ''
  return d.toISOString().slice(0, 10)
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

export async function createMaintenanceReminder(
  formData: FormData,
): Promise<CreateMaintenanceReminderResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入再新增提醒。')

  const name = str(formData.get('name'))
  if (!name) return fail('事項名稱必填。')

  const category = nullableStr(formData.get('category'))
  if (category && !VALID_CATEGORIES.has(category)) return fail('類別設定不正確。')

  const frequency = str(formData.get('frequency')) as ReminderFrequency
  if (!VALID_FREQUENCIES.has(frequency)) return fail('頻率設定不正確。')

  const dueOn = str(formData.get('due_on'))
  if (!isValidDate(dueOn)) return fail('下次提醒日期必填。')

  const detail = nullableStr(formData.get('detail'))

  const accountIdRaw = nullableStr(formData.get('account_id'))
  if (accountIdRaw) {
    const account = await validateAccount(supabase, accountIdRaw)
    if (!account) return fail('找不到該帳戶，請重新選擇。')
  }

  const householdId = await ensureDefaultHouseholdId(supabase, user)

  const { error } = await supabase.from('maintenance_reminders').insert({
    household_id: householdId,
    created_by: user.id,
    account_id: accountIdRaw,
    name,
    category,
    detail,
    due_on: dueOn,
    frequency,
    completed_at: null,
  })

  if (error) return fail(error.message)

  revalidatePath('/reminders')
  revalidatePath('/ledger/new')
  revalidatePath('/')

  return { ok: true }
}

export async function completeReminder(
  formData: FormData,
): Promise<CompleteReminderResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const user = await getCurrentUser()
  if (!user) return fail('請先登入。')

  const reminderId = str(formData.get('reminder_id'))
  if (!reminderId) return fail('找不到提醒 ID。')

  const { data: reminder, error: fetchErr } = await supabase
    .from('maintenance_reminders')
    .select('id, frequency, due_on')
    .eq('id', reminderId)
    .maybeSingle()

  if (fetchErr || !reminder) return fail('找不到該提醒。')

  const frequency = reminder.frequency as ReminderFrequency
  const now = new Date()
  const fromDate = reminder.due_on ? new Date(reminder.due_on + 'T12:00:00') : now

  if (frequency === 'once') {
    // 一次性：直接標記完成
    const { error } = await supabase
      .from('maintenance_reminders')
      .update({ completed_at: now.toISOString() })
      .eq('id', reminderId)
    if (error) return fail(error.message)
  } else {
    // 重複性：重置 due_on，清除 completed_at
    const next = nextDueOn(frequency, fromDate)
    const { error } = await supabase
      .from('maintenance_reminders')
      .update({ completed_at: null, due_on: next })
      .eq('id', reminderId)
    if (error) return fail(error.message)
  }

  revalidatePath('/reminders')
  revalidatePath('/')

  return { ok: true }
}
