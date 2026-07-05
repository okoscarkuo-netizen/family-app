'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { computeNextDueDate, type Frequency, type EndType } from '@/lib/recurring-db'

export type RecurringInput = {
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
  nextDueDate?: string | null
  endType: EndType
  endCount: number | null
  notes: string | null
}

export type RecurringResult = { ok: true; id: string } | { ok: false; error: string }

function validate(input: RecurringInput): string | null {
  if (!input.name.trim()) return '名稱不能空白'
  if (!input.accountId) return '請選擇帳戶'
  if (input.kind === 'transfer' && !input.targetAccountId) return '轉帳必須選目的帳戶'
  if (input.amount <= 0) return '金額必須大於 0'
  if (input.endType === 'count' && (!input.endCount || input.endCount < 1)) return '結束次數必須是正整數'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return '起始日期格式錯誤'
  if (input.nextDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate)) return '下次日期格式錯誤'
  return null
}

export async function createRecurringTransaction(input: RecurringInput): Promise<RecurringResult> {
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }

  const nextDue = input.nextDueDate ?? computeNextDueDate(input.startDate, input.frequency)

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      name: input.name.trim(),
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
      account_id: input.accountId,
      target_account_id: input.targetAccountId,
      target_amount: input.targetAmount,
      target_currency: input.targetCurrency,
      category_id: input.categoryId,
      merchant_id: input.merchantId,
      owner: input.owner,
      frequency: input.frequency,
      start_date: input.startDate,
      next_due_date: nextDue,
      end_type: input.endType,
      end_count: input.endCount,
      generated_count: 1,
      is_active: true,
      notes: input.notes,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  revalidatePath('/more')
  return { ok: true, id: data.id }
}

export async function updateRecurringTransaction(id: string, input: RecurringInput): Promise<RecurringResult> {
  const err = validate(input)
  if (err) return { ok: false, error: err }

  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }

  const { error } = await supabase
    .from('recurring_transactions')
    .update({
      name: input.name.trim(),
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
      account_id: input.accountId,
      target_account_id: input.targetAccountId,
      target_amount: input.targetAmount,
      target_currency: input.targetCurrency,
      category_id: input.categoryId,
      merchant_id: input.merchantId,
      owner: input.owner,
      frequency: input.frequency,
      start_date: input.startDate,
      next_due_date: input.nextDueDate ?? computeNextDueDate(input.startDate, input.frequency),
      end_type: input.endType,
      end_count: input.endCount,
      notes: input.notes,
    })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  revalidatePath('/more')
  return { ok: true, id }
}

export async function deleteRecurringTransaction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  return { ok: true }
}

export async function toggleRecurringTransaction(id: string, isActive: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: '系統未連接資料庫' }
  const { error } = await supabase.from('recurring_transactions').update({ is_active: isActive }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/recurring')
  return { ok: true }
}
