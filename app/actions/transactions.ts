'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { DATA_CACHE_TAGS } from '@/lib/data-cache'
import { normalizeOwner } from '@/lib/finance/types'
import { convertBetweenCurrencies, getRateSnapshotForDate, getTwdRateTable } from '@/lib/exchange-rates'
import { computeNextDueDate, type Frequency } from '@/lib/recurring-db'
import { supportsTransactionRecurringColumn } from '@/lib/family-transactions'
import { revalidatePath, revalidateTag } from 'next/cache'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>
type EditableTransactionKind = 'income' | 'expense' | 'transfer'
type TransactionPayload = {
  occurred_at: string
  kind: EditableTransactionKind
  title: string
  amount: number
  currency: string
  transfer_target_amount?: number | null
  transfer_target_currency?: string | null
  category_id: string | null
  account_id: string
  to_account_id: string | null
  owner: 'Oscar' | 'Livia'
  merchant: string | null
  merchant_id?: string | null
  occurred_on: string
  note: string | null
}

type StoredTransactionAccounts = {
  account_id: string | null
  to_account_id: string | null
}

type StoredTransactionSnapshot = StoredTransactionAccounts & {
  id: string
  kind: EditableTransactionKind
  title: string
  amount: number
  currency: string
  transfer_target_amount?: number | null
  transfer_target_currency?: string | null
  category_id: string | null
  account_id: string | null
  to_account_id: string | null
  owner: 'Oscar' | 'Livia'
  merchant: string | null
  occurred_at?: string | null
  occurred_on: string
  note: string | null
  recurring_id?: string | null
}

export type CreateTransactionResult =
  | { ok: true }
  | { ok: false; error: string }

const VALID_KINDS = new Set<EditableTransactionKind>(['income', 'expense', 'transfer'])
const VALID_CURRENCIES = new Set(['TWD', 'USD', 'JPY'])
const VALID_RECURRING_FREQUENCIES = new Set<Frequency>(['weekly', 'monthly', 'quarterly', 'yearly'])

function str(val: FormDataEntryValue | null): string {
  return val ? String(val).trim() : ''
}

function nullableStr(val: FormDataEntryValue | null): string | null {
  const s = str(val)
  return s === '' ? null : s
}

function normalizeMerchantName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-TW')
}

function normalizeOccurredAt(val: FormDataEntryValue | null): string {
  const raw = str(val)
  if (!raw) return new Date().toISOString()

  const normalized = raw.length === 16 ? `${raw}:00` : raw
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function isRecurringFrequency(value: string): value is Frequency {
  return VALID_RECURRING_FREQUENCIES.has(value as Frequency)
}

function stringifyFormValue(value: string | number | null | undefined) {
  return value == null ? '' : String(value)
}

function fallbackOccurredAt(transaction: StoredTransactionSnapshot) {
  return transaction.occurred_at ?? `${transaction.occurred_on}T12:00:00`
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

async function getCategoryName(supabase: AdminClient, categoryId: string | null) {
  if (!categoryId) return ''

  const { data, error } = await supabase
    .from('family_categories')
    .select('name')
    .eq('id', categoryId)
    .maybeSingle()

  if (error) {
    if (error.message.includes('family_categories')) return ''
    console.error('[transactions] getCategoryName failed:', error)
    return ''
  }

  return String(data?.name ?? '')
}

async function getAccountCurrencies(supabase: AdminClient, accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, string>()

  const { data, error } = await supabase
    .from('family_accounts')
    .select('id, currency')
    .in('id', accountIds)
    .eq('is_archived', false)

  if (error) {
    console.error('[transactions] getAccountCurrencies failed:', error)
    return new Map<string, string>()
  }

  return new Map((data ?? []).map((account) => [
    String(account.id),
    String(account.currency || 'TWD').toUpperCase(),
  ]))
}

async function upsertMerchant(
  supabase: AdminClient,
  merchant: string,
  lastUsedAt: string,
  currency: string,
) {
  const normalizedName = normalizeMerchantName(merchant)
  if (!normalizedName) return { ok: true as const, merchantId: null, supported: true as const }

  const { data: existing, error: existingError } = await supabase
    .from('family_merchants')
    .select('id, group_id')
    .eq('normalized_name', normalizedName)
    .maybeSingle()

  if (existingError) {
    if (existingError.message.includes('family_merchants')) {
      return { ok: true as const, merchantId: null, supported: false as const }
    }

    return { ok: false as const, error: normalizeCreateTransactionError(existingError.message) }
  }

  const desiredGroupName = merchantCurrencyGroupName(currency)
  const desiredGroupId = desiredGroupName
    ? await resolveMerchantGroupId(supabase, desiredGroupName)
    : null

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      name: merchant.trim(),
      last_used_at: lastUsedAt,
      is_archived: false,
    }

    if (!existing.group_id && desiredGroupId) {
      updatePayload.group_id = desiredGroupId
    }

    const { data, error } = await supabase
      .from('family_merchants')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) return { ok: false as const, error: normalizeCreateTransactionError(error.message) }
    return { ok: true as const, merchantId: data.id as string, supported: true as const }
  }

  const { data, error } = await supabase
    .from('family_merchants')
    .insert({
      name: merchant.trim(),
      normalized_name: normalizedName,
      last_used_at: lastUsedAt,
      is_archived: false,
      group_id: desiredGroupId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('family_merchants')) {
      return { ok: true as const, merchantId: null, supported: false as const }
    }

    return { ok: false as const, error: normalizeCreateTransactionError(error.message) }
  }

  return { ok: true as const, merchantId: data.id as string, supported: true as const }
}

function merchantCurrencyGroupName(currency: string) {
  if (currency === 'USD') return '美國'
  return '台灣'
}

async function resolveMerchantGroupId(supabase: AdminClient, groupName: string) {
  const { data, error } = await supabase
    .from('family_merchant_groups')
    .select('id')
    .eq('is_archived', false)
    .eq('name', groupName)
    .maybeSingle()

  if (error) {
    if (error.message.includes('family_merchant_groups')) return null
    throw new Error(error.message)
  }

  return data?.id ?? null
}

function uniqueAccountIds(...ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter(Boolean))) as string[]
}

function revalidateTransactionSurfaces(accountIds: string[], transactionId?: string) {
  revalidateTag(DATA_CACHE_TAGS.transactions, 'max')
  revalidateTag(DATA_CACHE_TAGS.merchants, 'max')
  revalidateTag(DATA_CACHE_TAGS.accounts, 'max')
  revalidatePath('/')
  revalidatePath('/ledger')
  revalidatePath('/ledger/new')
  revalidatePath('/accounts')
  if (transactionId) {
    revalidatePath(`/ledger/${encodeURIComponent(transactionId)}`)
    revalidatePath(`/ledger/${encodeURIComponent(transactionId)}/edit`)
  }
  for (const id of accountIds) {
    revalidatePath(`/accounts/${encodeURIComponent(id)}`)
  }
}

async function buildTransactionPayload(
  supabase: AdminClient,
  formData: FormData,
): Promise<
  | { ok: true; payload: TransactionPayload; accountIds: string[] }
  | { ok: false; error: string }
> {
  const kind = str(formData.get('kind')) as EditableTransactionKind
  if (!VALID_KINDS.has(kind)) {
    return fail(`Invalid kind: ${kind}`)
  }

  const amountRaw = parseFloat(str(formData.get('amount')))
  if (isNaN(amountRaw) || amountRaw < 0) {
    return fail('金額不可為負數')
  }

  const merchant = nullableStr(formData.get('merchant'))
  const categoryName = str(formData.get('category_name'))
  const title = merchant || categoryName || kind
  const occurredAt = normalizeOccurredAt(formData.get('occurred_at'))

  const owner = normalizeOwner(str(formData.get('owner')) || 'Oscar')
  if (owner !== 'Oscar' && owner !== 'Livia') {
    return fail(`Invalid owner: ${owner}`)
  }

  const currency = str(formData.get('currency')) || 'TWD'
  if (!VALID_CURRENCIES.has(currency)) {
    return fail(`Invalid currency: ${currency}`)
  }

  const accountId = nullableStr(formData.get('account_id'))
  const toAccountId = kind === 'transfer' ? nullableStr(formData.get('to_account_id')) : null
  if (!accountId) return fail(kind === 'transfer' ? '來源帳戶必填' : '帳戶必填')
  if (kind === 'transfer' && !toAccountId) return fail('目標帳戶必填')
  if (kind === 'transfer' && accountId === toAccountId) {
    return fail('來源帳戶與目標帳戶不能相同')
  }

  const accountIds = uniqueAccountIds(accountId, toAccountId)
  const { data: accounts, error: accountError } = await supabase
    .from('family_accounts')
    .select('id, currency, kind')
    .in('id', accountIds)
    .eq('is_archived', false)

  if (accountError) return fail(normalizeCreateTransactionError(accountError.message))
  const foundAccountIds = new Set((accounts ?? []).map(account => account.id))
  const missingAccount = accountIds.find(id => !foundAccountIds.has(id))
  if (missingAccount) return fail(`找不到帳戶：${missingAccount}`)

  const accountMap = new Map(
    (accounts ?? []).map((account) => [
      account.id,
      {
        currency: String(account.currency || 'TWD').toUpperCase(),
        kind: account.kind as 'asset' | 'liability',
      },
    ]),
  )
  const sourceAccount = accountMap.get(accountId)
  const targetAccount = toAccountId ? accountMap.get(toAccountId) : null

  if (kind === 'transfer' && (!sourceAccount || !targetAccount)) {
    return fail('找不到轉帳來源或目標帳戶')
  }

  const sourceCurrency = sourceAccount?.currency ?? currency
  const sourceAmount = parseFloat(amountRaw.toFixed(2))
  let transferTargetAmount: number | null = null
  let transferTargetCurrency: string | null = null

  if (kind === 'transfer' && targetAccount) {
    transferTargetCurrency = targetAccount.currency
    const targetAmountRaw = nullableStr(formData.get('transfer_target_amount'))
    const targetCurrencyRaw = str(formData.get('transfer_target_currency'))

    if (targetAmountRaw) {
      const parsedTargetAmount = parseFloat(targetAmountRaw)
      if (Number.isFinite(parsedTargetAmount) && parsedTargetAmount > 0) {
        transferTargetAmount = parseFloat(parsedTargetAmount.toFixed(2))
      }
    }

    if (!transferTargetAmount) {
      const rateTable = await getTwdRateTable()
      const snapshot = getRateSnapshotForDate(rateTable, occurredAt.slice(0, 10))
      const converted = convertBetweenCurrencies(sourceAmount, sourceCurrency, targetAccount.currency, snapshot)
      if (converted == null) {
        return fail(`找不到 ${sourceCurrency} 轉換成 ${targetAccount.currency} 的匯率，請先更新匯率資料。`)
      }
      transferTargetAmount = parseFloat(converted.toFixed(2))
      transferTargetCurrency = targetAccount.currency
    } else if (targetCurrencyRaw && targetCurrencyRaw.toUpperCase() !== targetAccount.currency) {
      return fail(`轉入帳戶幣別必須是 ${targetAccount.currency}`)
    }
  }

  const merchantResult = merchant
    ? await upsertMerchant(supabase, merchant, occurredAt, currency)
    : { ok: true as const, merchantId: null, supported: true as const }
  if (!merchantResult.ok) return fail(merchantResult.error)

  const payload: TransactionPayload = {
    occurred_at: occurredAt,
    kind,
    title,
    amount: sourceAmount,
    currency: sourceCurrency,
    ...(kind === 'transfer'
      ? {
          transfer_target_amount: transferTargetAmount,
          transfer_target_currency: transferTargetCurrency,
        }
      : {}),
    category_id: nullableStr(formData.get('category_id')),
    account_id: accountId,
    to_account_id: toAccountId,
    owner,
    merchant,
    occurred_on: occurredAt.slice(0, 10),
    note: nullableStr(formData.get('note')),
  }

  if (merchantResult.supported) {
    payload.merchant_id = merchantResult.merchantId
  }

  return { ok: true, payload, accountIds }
}

async function buildDetailsFormData(
  supabase: AdminClient,
  transaction: StoredTransactionSnapshot,
  formData: FormData,
): Promise<{ ok: true; formData: FormData } | { ok: false; error: string }> {
  const accountId = nullableStr(formData.get('account_id')) ?? transaction.account_id
  const toAccountId = transaction.kind === 'transfer'
    ? nullableStr(formData.get('to_account_id')) ?? transaction.to_account_id
    : null

  if (!accountId) return fail(transaction.kind === 'transfer' ? '來源帳戶必填' : '帳戶必填')
  if (transaction.kind === 'transfer' && !toAccountId) return fail('目標帳戶必填')
  if (transaction.kind === 'transfer' && accountId === toAccountId) {
    return fail('來源帳戶與目標帳戶不能相同')
  }

  const accountCurrencies = await getAccountCurrencies(supabase, uniqueAccountIds(accountId, toAccountId))
  const sourceCurrency = accountCurrencies.get(accountId) ?? String(transaction.currency || 'TWD').toUpperCase()
  const targetCurrency = toAccountId ? accountCurrencies.get(toAccountId) : null
  const categoryName = await getCategoryName(supabase, transaction.category_id)
  const merchant = formData.has('merchant')
    ? nullableStr(formData.get('merchant'))
    : transaction.merchant
  const note = formData.has('note')
    ? nullableStr(formData.get('note'))
    : transaction.note
  const nextFormData = new FormData()

  nextFormData.set('kind', transaction.kind)
  nextFormData.set('amount', stringifyFormValue(transaction.amount))
  nextFormData.set('currency', sourceCurrency)
  nextFormData.set('category_id', stringifyFormValue(transaction.category_id))
  nextFormData.set('category_name', categoryName || transaction.title)
  nextFormData.set('account_id', accountId)
  nextFormData.set('to_account_id', transaction.kind === 'transfer' ? stringifyFormValue(toAccountId) : '')
  nextFormData.set('merchant', stringifyFormValue(merchant))
  nextFormData.set('occurred_at', fallbackOccurredAt(transaction))
  nextFormData.set('owner', stringifyFormValue(transaction.owner))
  nextFormData.set('note', stringifyFormValue(note))

  if (transaction.kind === 'transfer') {
    const existingTargetCurrency = String(
      transaction.transfer_target_currency ?? transaction.currency ?? sourceCurrency,
    ).toUpperCase()
    const canPreserveTargetAmount = targetCurrency && existingTargetCurrency === targetCurrency

    nextFormData.set(
      'transfer_target_amount',
      canPreserveTargetAmount
        ? stringifyFormValue(transaction.transfer_target_amount ?? transaction.amount)
        : '',
    )
    nextFormData.set('transfer_target_currency', targetCurrency ?? '')
  }

  return { ok: true, formData: nextFormData }
}

async function syncRecurringSelection(
  supabase: AdminClient,
  transactionId: string,
  transaction: StoredTransactionSnapshot,
  payload: TransactionPayload,
  selection: string,
): Promise<CreateTransactionResult> {
  if (!selection) return { ok: true }

  const supportsRecurringId = await supportsTransactionRecurringColumn()
  if (!supportsRecurringId) {
    return fail('週期欄位還沒同步到資料庫，這次先保存其他欄位。')
  }

  if (selection === 'none') {
    const { error } = await supabase
      .from('family_transactions')
      .update({ recurring_id: null })
      .eq('id', transactionId)

    if (error) return fail(normalizeCreateTransactionError(error.message))
    revalidatePath('/recurring')
    revalidatePath('/more')
    return { ok: true }
  }

  if (!isRecurringFrequency(selection)) {
    return fail('週期設定不正確，請重新選一次。')
  }

  const recurringPayload = {
    name: payload.merchant?.trim() || payload.title || '定期交易',
    kind: payload.kind,
    amount: payload.amount,
    currency: payload.currency,
    account_id: payload.account_id,
    target_account_id: payload.to_account_id,
    target_amount: payload.transfer_target_amount ?? null,
    target_currency: payload.transfer_target_currency ?? null,
    category_id: payload.category_id,
    merchant_id: payload.merchant_id ?? null,
    owner: payload.owner,
    frequency: selection,
    next_due_date: computeNextDueDate(payload.occurred_on, selection),
    notes: payload.note,
    is_active: true,
  }

  if (transaction.recurring_id) {
    const { error } = await supabase
      .from('recurring_transactions')
      .update(recurringPayload)
      .eq('id', transaction.recurring_id)

    if (error) return fail(normalizeCreateTransactionError(error.message))
    revalidatePath('/recurring')
    revalidatePath('/more')
    return { ok: true }
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({
      ...recurringPayload,
      start_date: payload.occurred_on,
      end_type: 'forever',
      end_count: null,
      generated_count: 1,
    })
    .select('id')
    .single()

  if (error) return fail(normalizeCreateTransactionError(error.message))

  const { error: linkError } = await supabase
    .from('family_transactions')
    .update({ recurring_id: data.id })
    .eq('id', transactionId)

  if (linkError) return fail(normalizeCreateTransactionError(linkError.message))

  revalidatePath('/recurring')
  revalidatePath('/more')
  return { ok: true }
}

export async function createTransaction(formData: FormData): Promise<CreateTransactionResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const transaction = await buildTransactionPayload(supabase, formData)
  if (!transaction.ok) return transaction

  const { error } = await supabase.from('family_transactions').insert(transaction.payload)
  if (error) return fail(normalizeCreateTransactionError(error.message))

  revalidateTransactionSurfaces(transaction.accountIds)

  return { ok: true }
}

export async function updateTransaction(id: string, formData: FormData): Promise<CreateTransactionResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const { data: existing, error: existingError } = await supabase
    .from('family_transactions')
    .select('account_id, to_account_id')
    .eq('id', id)
    .maybeSingle()

  if (existingError) return fail(normalizeCreateTransactionError(existingError.message))
  if (!existing) return fail('找不到這筆交易，可能已被刪除。')

  const transaction = await buildTransactionPayload(supabase, formData)
  if (!transaction.ok) return transaction

  const { error } = await supabase
    .from('family_transactions')
    .update(transaction.payload)
    .eq('id', id)

  if (error) return fail(normalizeCreateTransactionError(error.message))

  const previous = existing as StoredTransactionAccounts
  revalidateTransactionSurfaces(
    uniqueAccountIds(
      previous.account_id,
      previous.to_account_id,
      ...transaction.accountIds,
    ),
    id,
  )

  return { ok: true }
}

export async function updateTransactionDetails(id: string, formData: FormData): Promise<CreateTransactionResult> {
  const supabase = createAdminClient()
  if (!supabase) return fail('資料庫連線目前不可用，請稍後再試。')

  const { data: existing, error: existingError } = await supabase
    .from('family_transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (existingError) return fail(normalizeCreateTransactionError(existingError.message))
  if (!existing) return fail('找不到這筆交易，可能已被刪除。')

  const previous = existing as StoredTransactionSnapshot
  const detailForm = await buildDetailsFormData(supabase, previous, formData)
  if (!detailForm.ok) return detailForm

  const transaction = await buildTransactionPayload(supabase, detailForm.formData)
  if (!transaction.ok) return transaction

  const { error } = await supabase
    .from('family_transactions')
    .update(transaction.payload)
    .eq('id', id)

  if (error) return fail(normalizeCreateTransactionError(error.message))

  revalidateTransactionSurfaces(
    uniqueAccountIds(
      previous.account_id,
      previous.to_account_id,
      ...transaction.accountIds,
    ),
    id,
  )

  const recurringSelection = str(formData.get('recurring_frequency'))
  const recurringResult = await syncRecurringSelection(
    supabase,
    id,
    previous,
    transaction.payload,
    recurringSelection,
  )
  if (!recurringResult.ok) return recurringResult

  revalidateTransactionSurfaces(transaction.accountIds, id)
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
  const accountIds = [transaction?.account_id, transaction?.to_account_id].filter(Boolean) as string[]
  revalidateTransactionSurfaces(accountIds, id)
}
