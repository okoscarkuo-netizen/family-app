import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve('imports/andromoney')
const rawPath = path.join(root, 'raw/_var_mobile_Containers_Data_Application_AF53372E-B0E9-45E9-8AB6-B9E0865E7DE8_Documents_AndroMoney.csv')
const envPath = path.resolve('.env.local')

const INCOME_CATEGORIES = new Set(['其他收入', '彥伶收入', '翰融收入', '股票', '銀行收入'])

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\r') continue
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function decodeBig5(buffer) {
  return new TextDecoder('big5').decode(buffer)
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function parseRawDate(value) {
  const raw = normalizeText(value)
  if (!raw || raw.length < 8) return null
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(4, 6))
  const day = Number(raw.slice(6, 8))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  const parsed = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return iso
}

function buildAccountResolver(accounts) {
  const byName = new Map()
  const byNormalized = new Map()

  for (const account of accounts) {
    byName.set(account.name, account)
    byNormalized.set(normalizeText(account.name).toLowerCase(), account)
  }

  return function resolveAccount(rawName, currency) {
    const cleanedName = normalizeText(rawName)
    if (!cleanedName) return null

    const exact = byName.get(cleanedName)
    if (exact) return exact

    const normalized = byNormalized.get(cleanedName.toLowerCase())
    if (normalized) return normalized

    const currencyVariant = byName.get(`${cleanedName} (${currency})`)
    if (currencyVariant) return currencyVariant

    const currencyVariantNormalized = byNormalized.get(normalizeText(`${cleanedName} (${currency})`).toLowerCase())
    if (currencyVariantNormalized) return currencyVariantNormalized

    // CSV uses B- prefix for bank accounts; DB uses ฿- or ฿ (for US accounts)
    if (cleanedName.startsWith('B-US-')) {
      const remapped = '฿US-' + cleanedName.slice('B-US-'.length)
      const r = byName.get(remapped) ?? byNormalized.get(remapped.toLowerCase())
      if (r) return r
    }
    if (cleanedName.startsWith('B-')) {
      const remapped = '฿-' + cleanedName.slice('B-'.length)
      const r = byName.get(remapped) ?? byNormalized.get(remapped.toLowerCase())
      if (r) return r
    }
    // CSV uses C- prefix for credit cards; DB uses ₵-
    if (cleanedName.startsWith('C-')) {
      const remapped = '₵-' + cleanedName.slice('C-'.length)
      const r = byName.get(remapped) ?? byNormalized.get(remapped.toLowerCase())
      if (r) return r
      const remappedCurrency = byName.get(`${remapped} (${currency})`) ?? byNormalized.get(normalizeText(`${remapped} (${currency})`).toLowerCase())
      if (remappedCurrency) return remappedCurrency
    }

    const baseNameMatches = accounts.filter((account) =>
      normalizeText(account.name).toLowerCase().startsWith(`${cleanedName.toLowerCase()} (`)
    )
    if (baseNameMatches.length === 1) {
      return baseNameMatches[0]
    }

    return null
  }
}

function buildCategoryResolver(categories) {
  const roots = new Map()
  const children = new Map()

  for (const category of categories) {
    if (category.parent_id) {
      const key = `${category.parent_id}::${category.name}`
      children.set(key, category)
    } else {
      const key = `${category.kind}::${category.name}`
      roots.set(key, category)
    }
  }

  return function resolveCategory(kind, categoryName, subCategoryName) {
    const cleanedCategory = normalizeText(categoryName)
    const cleanedSubCategory = normalizeText(subCategoryName)
    let root = roots.get(`${kind}::${cleanedCategory}`)
    if (!root && kind === 'transfer') {
      root =
        roots.get(`transfer::帳戶轉帳`) ??
        roots.get(`transfer::一般轉帳`) ??
        [...roots.values()].find((category) => category.kind === 'transfer') ??
        null
    }
    if (!root) return null
    if (!cleanedSubCategory) return root

    const child = children.get(`${root.id}::${cleanedSubCategory}`)
    if (child) return child

    if (kind === 'transfer') {
      const fallbackChild = children.get(`${root.id}::${cleanedSubCategory}`)
      return fallbackChild ?? root
    }

    return root
  }
}

function buildMerchantResolver(merchants) {
  const byName = new Map()
  const byNormalized = new Map()

  for (const merchant of merchants) {
    byName.set(merchant.name, merchant)
    byNormalized.set(normalizeText(merchant.name).toLowerCase(), merchant)
  }

  return function resolveMerchant(rawName) {
    const cleaned = normalizeText(rawName)
    if (!cleaned) return null
    return byName.get(cleaned) ?? byNormalized.get(cleaned.toLowerCase()) ?? null
  }
}

function accountDeltaForTransaction(kind, accountKind, amount, isSource) {
  if (amount === 0) return 0

  if (kind === 'expense') {
    return accountKind === 'liability' ? amount : -amount
  }

  if (kind === 'income') {
    return accountKind === 'liability' ? -amount : amount
  }

  if (kind === 'transfer') {
    if (isSource) {
      return accountKind === 'liability' ? amount : -amount
    }

    return accountKind === 'liability' ? -amount : amount
  }

  throw new Error(`Unsupported transaction kind: ${kind}`)
}

function formatCount(n) {
  return n.toLocaleString('zh-TW')
}

function buildTransactionOccurredAt(dateIso, sequence) {
  const base = new Date(`${dateIso}T12:00:00Z`)
  base.setSeconds(base.getSeconds() + sequence)
  return base.toISOString()
}

function readRows() {
  const buffer = fs.readFileSync(rawPath)
  const text = decodeBig5(buffer)
  const rows = parseCsv(text)
  const headerIndex = rows.findIndex((row) => row[0] === 'Id')
  if (headerIndex < 0) {
    throw new Error('找不到 AndroMoney 表頭列')
  }

  const header = rows[headerIndex]
  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.length >= header.length && row[0])
  const col = Object.fromEntries(header.map((name, index) => [name, index]))
  return { header, dataRows, col }
}

function classifyKind(category, paymentAccount, receiveAccount) {
  if (category === 'SYSTEM') return 'system'
  if (category === '轉帳') return 'transfer'
  if (paymentAccount && receiveAccount) return 'transfer'
  if (paymentAccount) return 'expense'
  if (receiveAccount) return 'income'
  return 'other'
}

function getSourceOwner(account) {
  if (!account) return 'Oscar'
  return account.owner === 'Livia' ? 'Livia' : 'Oscar'
}

async function main() {
  loadDotEnv(envPath)

  const apply = process.argv.includes('--apply')
  const dryRun = !apply

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const [accountsResult, categoriesResult, merchantsResult] = await Promise.all([
    supabase.from('family_accounts').select('id, name, owner, kind, balance, currency'),
    supabase.from('family_categories').select('id, name, kind, parent_id, is_archived').eq('is_archived', false),
    supabase.from('family_merchants').select('id, name, normalized_name, is_archived').eq('is_archived', false),
  ])

  if (accountsResult.error) throw new Error(accountsResult.error.message)
  if (categoriesResult.error) throw new Error(categoriesResult.error.message)
  if (merchantsResult.error) throw new Error(merchantsResult.error.message)

  const accounts = accountsResult.data ?? []
  const categories = categoriesResult.data ?? []
  const merchants = merchantsResult.data ?? []

  const resolveAccount = buildAccountResolver(accounts)
  const resolveCategory = buildCategoryResolver(categories)
  const resolveMerchant = buildMerchantResolver(merchants)

  const { dataRows, col } = readRows()

  const rowsByDate = new Map()
  const importRows = []
  const summary = {
    totalRows: dataRows.length,
    skippedSystem: 0,
    skippedBlankAccounts: 0,
    skippedSameAccountTransfers: 0,
    skippedMissingDate: 0,
    skippedMissingAccount: 0,
    skippedOther: 0,
    imported: 0,
    zeroAmount: 0,
    nonZero: 0,
  }

  const unresolvedAccounts = new Map()
  const unresolvedCategories = new Map()
  const unresolvedMerchants = new Map()

  for (const row of dataRows) {
    const category = normalizeText(row[col['分類']])
    const subCategory = normalizeText(row[col['子分類']])
    const paymentAccountName = normalizeText(row[col['付款(轉出)']])
    const receiveAccountName = normalizeText(row[col['收款(轉入)']])

    const kind = classifyKind(category, paymentAccountName, receiveAccountName)
    if (kind === 'system') {
      summary.skippedSystem += 1
      continue
    }

    if (!paymentAccountName && !receiveAccountName) {
      summary.skippedBlankAccounts += 1
      continue
    }

    if (paymentAccountName && receiveAccountName && paymentAccountName === receiveAccountName) {
      summary.skippedSameAccountTransfers += 1
      continue
    }

    const rawDate = parseRawDate(row[col['日期']])
    if (!rawDate) {
      summary.skippedMissingDate += 1
      continue
    }

    const amount = Math.abs(Number(row[col['金額']] ?? 0) || 0)
    const currency = normalizeText(row[col['幣別']]) || 'TWD'
    const note = normalizeText(row[col['備註']])
    const merchantName = normalizeText(row[col['商家(公司)']])

    const categoryRecord = resolveCategory(
      kind === 'transfer' ? 'transfer' : INCOME_CATEGORIES.has(category) ? 'income' : kind,
      category,
      subCategory,
    )
    if (!categoryRecord && amount !== 0 && kind !== 'transfer') {
      unresolvedCategories.set(`${category} / ${subCategory || '(無子分類)'}`, (unresolvedCategories.get(`${category} / ${subCategory || '(無子分類)'}`) ?? 0) + 1)
    }

    const sourceAccount = paymentAccountName ? resolveAccount(paymentAccountName, currency) : null
    const targetAccount = receiveAccountName ? resolveAccount(receiveAccountName, currency) : null

    if (amount !== 0) {
      if (kind === 'income' && !targetAccount) {
        unresolvedAccounts.set(receiveAccountName, (unresolvedAccounts.get(receiveAccountName) ?? 0) + 1)
        summary.skippedMissingAccount += 1
        continue
      }

      if (kind === 'expense' && !sourceAccount) {
        unresolvedAccounts.set(paymentAccountName, (unresolvedAccounts.get(paymentAccountName) ?? 0) + 1)
        summary.skippedMissingAccount += 1
        continue
      }

      if (kind === 'transfer' && (!sourceAccount || !targetAccount)) {
        if (!sourceAccount && paymentAccountName) unresolvedAccounts.set(paymentAccountName, (unresolvedAccounts.get(paymentAccountName) ?? 0) + 1)
        if (!targetAccount && receiveAccountName) unresolvedAccounts.set(receiveAccountName, (unresolvedAccounts.get(receiveAccountName) ?? 0) + 1)
        summary.skippedMissingAccount += 1
        continue
      }
    }

    const resolvedMerchant = merchantName ? resolveMerchant(merchantName) : null
    if (merchantName && !resolvedMerchant) {
      unresolvedMerchants.set(merchantName, (unresolvedMerchants.get(merchantName) ?? 0) + 1)
    }

    const occurrenceCount = rowsByDate.get(rawDate) ?? 0
    rowsByDate.set(rawDate, occurrenceCount + 1)
    const occurredAt = buildTransactionOccurredAt(rawDate, occurrenceCount)
    const ownerAccount = kind === 'income' ? targetAccount : sourceAccount

    const transaction = {
      id: crypto.randomUUID(),
      kind,
      title: subCategory || category || row[col['分類']] || '未命名交易',
      amount,
      currency,
      category_id: kind === 'transfer' ? null : categoryRecord?.id ?? null,
      account_id: kind === 'income' ? targetAccount?.id ?? null : sourceAccount?.id ?? null,
      to_account_id: kind === 'transfer' ? targetAccount?.id ?? null : null,
      owner: getSourceOwner(ownerAccount),
      merchant: merchantName || null,
      merchant_id: resolvedMerchant?.id ?? null,
      occurred_on: rawDate,
      occurred_at: occurredAt,
      created_at: occurredAt,
      note: note || null,
    }

    importRows.push(transaction)
    summary.imported += 1
    if (amount === 0) summary.zeroAmount += 1
    else summary.nonZero += 1
  }

  const accountDeltas = new Map()
  for (const tx of importRows) {
    if (tx.amount === 0) continue

    if (tx.kind === 'income' || tx.kind === 'expense') {
      const account = accounts.find((row) => row.id === tx.account_id)
      if (!account) continue
      const delta = accountDeltaForTransaction(tx.kind, account.kind, tx.amount, true)
      accountDeltas.set(account.id, (accountDeltas.get(account.id) ?? 0) + delta)
      continue
    }

    if (tx.kind === 'transfer') {
      const source = accounts.find((row) => row.id === tx.account_id)
      const target = accounts.find((row) => row.id === tx.to_account_id)
      if (!source || !target) continue
      accountDeltas.set(source.id, (accountDeltas.get(source.id) ?? 0) + accountDeltaForTransaction(tx.kind, source.kind, tx.amount, true))
      accountDeltas.set(target.id, (accountDeltas.get(target.id) ?? 0) + accountDeltaForTransaction(tx.kind, target.kind, tx.amount, false))
    }
  }

  const sortedDeltaPreview = [...accountDeltas.entries()]
        .map(([accountId, delta]) => {
      const account = accounts.find((row) => row.id === accountId)
      return {
        name: account?.name ?? accountId,
        currency: account?.currency ?? 'TWD',
        delta,
        balance: account?.balance ?? 0,
      }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  console.log('# AndroMoney transaction safe reimport')
  console.log('')
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`)
  console.log(`Raw rows: ${formatCount(summary.totalRows)}`)
  console.log(`Imported transactions: ${formatCount(summary.imported)}`)
  console.log(`Non-zero transactions: ${formatCount(summary.nonZero)}`)
  console.log(`Zero-amount transactions: ${formatCount(summary.zeroAmount)}`)
  console.log(`Skipped: system=${summary.skippedSystem}, blank=${summary.skippedBlankAccounts}, same-account-transfer=${summary.skippedSameAccountTransfers}, missing-date=${summary.skippedMissingDate}, missing-account=${summary.skippedMissingAccount}`)

  if (unresolvedAccounts.size > 0) {
    console.log('')
    console.log('Unresolved accounts:')
    for (const [name, count] of [...unresolvedAccounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${name}: ${count}`)
    }
  }

  if (unresolvedCategories.size > 0) {
    console.log('')
    console.log('Unresolved categories:')
    for (const [name, count] of [...unresolvedCategories.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${name}: ${count}`)
    }
  }

  if (unresolvedMerchants.size > 0) {
    console.log('')
    console.log('Unresolved merchants:')
    for (const [name, count] of [...unresolvedMerchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  - ${name}: ${count}`)
    }
  }

  console.log('')
  console.log('Top balance deltas (absolute):')
  for (const row of sortedDeltaPreview.slice(0, 15)) {
    console.log(`  - ${row.name}: delta=${row.delta.toFixed(2)} | balance=${row.balance.toFixed(2)} | preserve-base=${(row.balance - row.delta).toFixed(2)}`)
  }

  if (dryRun) {
    console.log('')
    console.log('Dry-run only. Re-run with --apply after unresolved accounts/categories are cleared.')
    return
  }

  if (unresolvedAccounts.size > 0 || unresolvedCategories.size > 0) {
    throw new Error('Refusing to apply because unresolved accounts or categories remain.')
  }

  // Step 1: update account opening balances
  console.log('\nStep 1: updating account balances...')
  const balanceUpdates = [...accountDeltas.entries()].map(([accountId, delta]) => {
    const account = accounts.find((a) => a.id === accountId)
    return { id: accountId, balance: Math.round((account.balance - delta) * 100) / 100 }
  })
  for (const update of balanceUpdates) {
    const { error: balErr } = await supabase
      .from('family_accounts')
      .update({ balance: update.balance })
      .eq('id', update.id)
    if (balErr) throw new Error(`Balance update failed for ${update.id}: ${balErr.message}`)
  }
  console.log(`  Updated ${balanceUpdates.length} account balances.`)

  // Step 2: truncate existing data via RPC
  console.log('Step 2: truncating existing transactions...')
  const { error: truncErr } = await supabase.rpc('truncate_family_transactions')
  if (truncErr) throw new Error(`Truncate failed: ${truncErr.message}`)
  console.log('  Truncated family_transactions and family_ledger_entries.')

  // Step 3: insert transactions in batches
  console.log('Step 3: inserting transactions in batches...')
  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < importRows.length; i += BATCH) {
    const batch = importRows.slice(i, i + BATCH).map((tx) => ({
      id: tx.id,
      kind: tx.kind,
      title: tx.title,
      amount: tx.amount,
      currency: tx.currency,
      category_id: tx.category_id ?? null,
      account_id: tx.account_id ?? null,
      to_account_id: tx.to_account_id ?? null,
      owner: tx.owner,
      merchant: tx.merchant ?? null,
      merchant_id: tx.merchant_id ?? null,
      occurred_on: tx.occurred_on,
      occurred_at: tx.occurred_at,
      note: tx.note ?? null,
      created_at: tx.created_at,
    }))
    const { error: insErr } = await supabase.from('family_transactions').insert(batch)
    if (insErr) throw new Error(`Insert batch ${i}-${i + BATCH} failed: ${insErr.message}`)
    inserted += batch.length
    process.stdout.write(`\r  Inserted ${inserted} / ${importRows.length}...`)
  }
  console.log(`\n  Done.`)

  console.log('')
  console.log('Import complete:')
  console.log(JSON.stringify({
    transactions: importRows.length,
    nonzero_transactions: importRows.filter((t) => t.amount !== 0).length,
    zero_amount_transactions: importRows.filter((t) => t.amount === 0).length,
    affected_accounts: balanceUpdates.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
