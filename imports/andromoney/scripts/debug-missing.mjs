import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve('.env.local')
const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
for (const line of lines) {
  const i = line.indexOf('=')
  if (i > 0 && !(line.slice(0, i).trim() in process.env)) {
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const { data: accounts } = await supabase
  .from('family_accounts')
  .select('id, name, currency')
  .eq('is_archived', false)

const byName = new Map(accounts.map((a) => [a.name, a]))
const byNorm = new Map(accounts.map((a) => [a.name.trim().toLowerCase(), a]))

function resolve(rawName, currency) {
  const c = rawName.trim().replace(/\s+/g, ' ')
  if (!c) return null
  if (byName.has(c)) return byName.get(c)
  if (byNorm.has(c.toLowerCase())) return byNorm.get(c.toLowerCase())
  if (byName.has(`${c} (${currency})`)) return byName.get(`${c} (${currency})`)
  const matches = accounts.filter((a) =>
    a.name.trim().toLowerCase().startsWith(`${c.toLowerCase()} (`)
  )
  if (matches.length === 1) return matches[0]
  return null
}

const rawPath = 'imports/andromoney/raw/_var_mobile_Containers_Data_Application_AF53372E-B0E9-45E9-8AB6-B9E0865E7DE8_Documents_AndroMoney.csv'
const text = new TextDecoder('big5').decode(fs.readFileSync(rawPath))
const rows = text.split(/\r?\n/).map((r) => {
  const cells = []
  let cell = ''
  let inQ = false
  for (let i = 0; i < r.length; i++) {
    const ch = r[i]
    if (inQ) {
      if (ch === '"' && r[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQ = false
      else cell += ch
    } else if (ch === '"') { inQ = true }
    else if (ch === ',') { cells.push(cell); cell = '' }
    else cell += ch
  }
  cells.push(cell)
  return cells
})

const hi = rows.findIndex((r) => r[0] === 'Id')
const header = rows[hi]
const col = Object.fromEntries(header.map((n, i) => [n, i]))
const data = rows.slice(hi + 1).filter((r) => r.length >= header.length && r[0])

const missing = new Map()
let skipped = 0

for (const row of data) {
  const cat = row[col['分類']]?.trim()
  if (cat === 'SYSTEM') continue
  const pay = row[col['付款(轉出)']]?.trim().replace(/\s+/g, ' ') || ''
  const rec = row[col['收款(轉入)']]?.trim().replace(/\s+/g, ' ') || ''
  if (!pay && !rec) continue
  if (pay && rec && pay === rec) continue
  const date = row[col['日期']]?.trim()
  if (!date || date.length < 8) continue
  const amount = Math.abs(Number(row[col['金額']] || 0))
  const currency = row[col['幣別']]?.trim() || 'TWD'
  const kind =
    cat === '轉帳' ? 'transfer'
    : pay && rec ? 'transfer'
    : pay ? 'expense'
    : rec ? 'income'
    : 'other'
  if (amount === 0) continue
  const src = pay ? resolve(pay, currency) : null
  const tgt = rec ? resolve(rec, currency) : null
  if (kind === 'income' && !tgt) { missing.set(rec, (missing.get(rec) || 0) + 1); skipped++; continue }
  if (kind === 'expense' && !src) { missing.set(pay, (missing.get(pay) || 0) + 1); skipped++; continue }
  if (kind === 'transfer' && (!src || !tgt)) {
    if (!src && pay) missing.set(pay, (missing.get(pay) || 0) + 1)
    if (!tgt && rec) missing.set(rec, (missing.get(rec) || 0) + 1)
    skipped++
    continue
  }
}

console.log(`Total skipped (non-zero, missing account): ${skipped}`)
console.log('Missing account names (sorted by frequency):')
for (const [name, count] of [...missing.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}x  "${name}"`)
}
