'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function str(val: FormDataEntryValue | null): string {
  return val ? String(val).trim() : ''
}

function nullableStr(val: FormDataEntryValue | null): string | null {
  const s = str(val)
  return s === '' ? null : s
}

export async function createTransaction(formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('Database client unavailable')

  const kind = str(formData.get('kind'))
  if (!['income', 'expense', 'transfer'].includes(kind)) {
    throw new Error(`Invalid kind: ${kind}`)
  }

  const amountRaw = parseFloat(str(formData.get('amount')))
  if (isNaN(amountRaw) || amountRaw <= 0) {
    throw new Error('金額必須大於 0')
  }

  const merchant = nullableStr(formData.get('merchant'))
  const categoryName = str(formData.get('category_name'))
  const title = merchant || categoryName || kind

  const payload = {
    kind,
    title,
    amount: amountRaw,
    currency: str(formData.get('currency')) || 'TWD',
    category_id: nullableStr(formData.get('category_id')),
    account_id: nullableStr(formData.get('account_id')),
    to_account_id: kind === 'transfer' ? nullableStr(formData.get('to_account_id')) : null,
    owner: str(formData.get('owner')) || '共同',
    merchant,
    occurred_on: str(formData.get('occurred_on')) || new Date().toISOString().split('T')[0],
    note: nullableStr(formData.get('note')),
  }

  const { error } = await supabase.from('family_transactions').insert(payload)
  if (error) throw new Error(error.message)

  revalidatePath('/ledger')
  redirect('/ledger')
}

export async function deleteTransaction(id: string) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('Database client unavailable')

  const { error } = await supabase
    .from('family_transactions')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ledger')
}
