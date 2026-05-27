import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type ReminderItem = {
  id: string
  name: string
  detail: string | null
  category: string | null
  dueOn: string | null
  frequency: string
  accountId: string | null
  accountName: string | null
  completedAt: string | null
}

export type ReminderGroup = {
  category: string
  items: ReminderItem[]
}

const CATEGORY_ORDER = ['車子', '房屋', '帳單', '家事', '其他']

export async function getReminders(): Promise<ReminderItem[]> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return []

  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('maintenance_reminders')
    .select(`
      id, name, detail, category, due_on, frequency, account_id, completed_at,
      family_accounts ( name )
    `)
    .is('completed_at', null)
    .order('due_on', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('getReminders error:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    detail: row.detail ?? null,
    category: row.category ?? null,
    dueOn: row.due_on ?? null,
    frequency: row.frequency,
    accountId: row.account_id ?? null,
    accountName: (row.family_accounts as unknown as { name: string } | null)?.name ?? null,
    completedAt: row.completed_at ?? null,
  }))
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
