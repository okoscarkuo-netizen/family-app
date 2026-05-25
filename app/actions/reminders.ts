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

const VALID_FREQUENCIES = new Set<ReminderFrequency>([
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
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

function normalizeReminderError(message: string) {
  if (message.includes('foreign key constraint')) {
    return '找不到對應的家庭帳戶，請重新選擇。'
  }

  return message
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

async function getCurrentUser() {
  const authClient = await createClient()
  const { data, error } = await authClient.auth.getUser()
  if (error) throw new Error(error.message)
  if (!data.user) return null
  return data.user
}

async function validateReminderAccount(supabase: AdminClient, accountId: string) {
  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, type, is_archived')
    .eq('id', accountId)
    .maybeSingle()

  if (error) {
    if (error.message.includes('family_accounts')) return null
    throw new Error(error.message)
  }

  if (!data || data.is_archived) return null
  if (data.type !== '房地產' && data.type !== '車輛') return null

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

  const accountId = str(formData.get('account_id'))
  if (!accountId) return fail('請選擇房屋或汽車帳戶。')

  const frequency = str(formData.get('frequency')) as ReminderFrequency
  if (!VALID_FREQUENCIES.has(frequency)) {
    return fail('頻率設定不正確。')
  }

  const dueOn = str(formData.get('due_on'))
  if (!isValidDate(dueOn)) return fail('下次提醒日期必填。')

  const detail = nullableStr(formData.get('detail'))
  const account = await validateReminderAccount(supabase, accountId)
  if (!account) return fail('提醒帳戶請選房屋或汽車帳戶。')

  const householdId = await ensureDefaultHouseholdId(supabase, user)

  const { error } = await supabase.from('maintenance_reminders').insert({
    household_id: householdId,
    created_by: user.id,
    account_id: account.id,
    name,
    detail,
    due_on: dueOn,
    frequency,
    completed_at: null,
  })

  if (error) return fail(normalizeReminderError(error.message))

  revalidatePath('/reminders')
  revalidatePath('/ledger/new')
  revalidatePath('/')

  return { ok: true }
}
