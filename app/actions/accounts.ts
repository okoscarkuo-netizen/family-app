'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_CURRENCIES = new Set(['TWD', 'USD', 'JPY', 'CNY'])

function getString(formData: FormData, key: string, fallback = ''): string {
  return String(formData.get(key) ?? fallback).trim()
}

export async function createAccount(formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const name = getString(formData, 'name')
  if (!name) throw new Error('名稱必填')

  const currency = VALID_CURRENCIES.has(getString(formData, 'currency'))
    ? getString(formData, 'currency')
    : 'TWD'
  const kind = getString(formData, 'kind') === 'liability' ? 'liability' : 'asset'
  const balance = Math.max(0, Number(formData.get('balance') ?? 0))

  const { data: maxRow } = await supabase
    .from('family_accounts')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sortOrder = (maxRow?.sort_order ?? 0) + 1

  const id = `manual-${Date.now()}-${name.slice(0, 20).replace(/\s+/g, '-')}`

  const { error } = await supabase.from('family_accounts').insert({
    id,
    name,
    type: getString(formData, 'type') || '現金',
    owner: getString(formData, 'owner') || '共同',
    kind,
    balance,
    currency,
    hidden: formData.get('hidden') === 'true',
    sort_order: sortOrder,
    is_archived: false,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}

export async function updateAccount(id: string, formData: FormData) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const name = getString(formData, 'name')
  if (!name) throw new Error('名稱必填')

  const currency = VALID_CURRENCIES.has(getString(formData, 'currency'))
    ? getString(formData, 'currency')
    : 'TWD'
  const kind = getString(formData, 'kind') === 'liability' ? 'liability' : 'asset'
  const balance = Math.max(0, Number(formData.get('balance') ?? 0))

  const { error } = await supabase
    .from('family_accounts')
    .update({
      name,
      type: getString(formData, 'type') || '現金',
      owner: getString(formData, 'owner') || '共同',
      kind,
      balance,
      currency,
      hidden: formData.get('hidden') === 'true',
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
  revalidatePath(`/accounts/${encodeURIComponent(id)}`)
}

export async function archiveAccount(id: string) {
  const supabase = createAdminClient()
  if (!supabase) throw new Error('資料庫連線失敗')

  const { error } = await supabase
    .from('family_accounts')
    .update({ is_archived: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}
