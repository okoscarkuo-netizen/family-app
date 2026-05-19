'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeOwner } from '@/lib/finance/types'
import { revalidatePath } from 'next/cache'

export type CreateTransactionResult =
  | { ok: true }
  | { ok: false; error: string }

function str(val: FormDataEntryValue | null): string {
  return val ? String(val).trim() : ''
}

function nullableStr(val: FormDataEntryValue | null): string | null {
  const s = str(val)
  return s === '' ? null : s
}

function normalizeOccurredAt(val: FormDataEntryValue | null): string {
  const raw = str(val)
  if (!raw) return new Date().toISOString()

  const normalized = raw.length === 16 ? `${raw}:00` : raw
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function fail(error: string): CreateTransactionResult {
  return { ok: false, error }
}

function normalizeCreateTransactionError(message: string) {
  if (message.includes('balance would become negative')) {
    return '這個帳戶餘額不足，支出後會變成負數。請改選其他帳戶或先調整帳戶餘額。'
  }

  if (message.includes('violates foreign key constraint')) {
    return '這筆資料引用的帳戶或分類不存在，請重新選一次帳戶或分類。'
  }

  return message
}

export async function createTransaction(formData: FormData): Promise<CreateTransactionResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const kind = str(formData.get('kind')) as 'income' | 'expense' | 'transfer'
  if (!['income', 'expense', 'transfer'].includes(kind)) {
    return fail(`Invalid kind: ${kind}`)
  }

  const amountRaw = parseFloat(str(formData.get('amount')))
  if (isNaN(amountRaw) || amountRaw <= 0) {
    return fail('金額必須大於 0')
  }

  const merchant = nullableStr(formData.get('merchant'))
  const categoryName = str(formData.get('category_name'))
  const title = merchant || categoryName || kind

  const owner = normalizeOwner(str(formData.get('owner')) || 'Oscar')
  if (!['Oscar', 'Livia'].includes(owner)) {
    return fail(`Invalid owner: ${owner}`)
  }

  const currency = str(formData.get('currency')) || 'TWD'
  if (!['TWD', 'USD', 'JPY', 'CNY'].includes(currency)) {
    return fail(`Invalid currency: ${currency}`)
  }

  const accountId = nullableStr(formData.get('account_id'))
  const toAccountId = kind === 'transfer' ? nullableStr(formData.get('to_account_id')) : null
  if (!accountId) return fail(kind === 'transfer' ? '來源帳戶必填' : '帳戶必填')
  if (kind === 'transfer' && !toAccountId) return fail('目標帳戶必填')
  if (kind === 'transfer' && accountId === toAccountId) {
    return fail('來源帳戶與目標帳戶不能相同')
  }

  const accountIds = Array.from(new Set([accountId, toAccountId].filter(Boolean))) as string[]
  const { data: accounts, error: accountError } = await supabase
    .from('family_accounts')
    .select('id')
    .in('id', accountIds)
    .eq('is_archived', false)

  if (accountError) return fail(normalizeCreateTransactionError(accountError.message))
  const foundAccountIds = new Set((accounts ?? []).map(account => account.id))
  const missingAccount = accountIds.find(id => !foundAccountIds.has(id))
  if (missingAccount) return fail(`找不到帳戶：${missingAccount}`)

  const payload = {
    occurred_at: normalizeOccurredAt(formData.get('occurred_at')),
    kind,
    title,
    amount: parseFloat(amountRaw.toFixed(2)),
    currency,
    category_id: nullableStr(formData.get('category_id')),
    account_id: accountId,
    to_account_id: toAccountId,
    owner,
    merchant,
    occurred_on: normalizeOccurredAt(formData.get('occurred_at')).slice(0, 10),
    note: nullableStr(formData.get('note')),
  }

  const { error } = await supabase.from('family_transactions').insert(payload)
  if (error) return fail(normalizeCreateTransactionError(error.message))

  revalidatePath('/ledger')
  revalidatePath('/ledger/new')
  revalidatePath('/accounts')
  for (const id of accountIds) {
    revalidatePath(`/accounts/${encodeURIComponent(id)}`)
  }

  return { ok: true }
}

export async function deleteTransaction(id: string) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('Database client unavailable')

  const { data: transaction } = await supabase
    .from('family_transactions')
    .select('account_id, to_account_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('family_transactions')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ledger')
  revalidatePath('/accounts')
  const accountIds = [transaction?.account_id, transaction?.to_account_id].filter(Boolean) as string[]
  for (const accountId of accountIds) {
    revalidatePath(`/accounts/${encodeURIComponent(accountId)}`)
  }
}
