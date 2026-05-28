---
name: family-bank-reconciliation
description: Use when reconciling bank, credit-card, loan, or brokerage statements for the Family_App project. Files live in `imports/reconciliation/raw` (read-only); confirm the Family_App account before first analysis; emit reviewable add/update/delete/category suggestions; never auto-apply.
---

# Family Bank Reconciliation

Paths under `/Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App/imports/reconciliation/`: `raw/` read-only · `generated/` outputs · `references/shapes.md` on demand.

**Hard rules:** never modify `raw/`; derived → `generated/`; no Supabase writes until user approves; deletions never auto.

**Card-payment policy for the two US cards:** Discover 5490 and Bonvoy Brilliant Amex 21006 always settle from `฿US-HSBC_融_薪轉`. When a card-payment row does not match exactly, search the same source account within ±10 days of the statement date. If a nearby App transfer exists but the amount is off, update the amount. If no transfer exists in that window, create the transfer from `฿US-HSBC_融_薪轉` to the card. If both the date and amount are far off, stop and ask the user to review it.

**First-time per file:** if not in `generated/statement-account-map.json`, ask `這份帳單要對應 Family App 裡的哪一個帳戶？`, list active `family_accounts` (`id`,`name`,`type`,`owner`,`kind`,`currency`); on yes, append mapping keyed by `filename+size+mtime`(+optional `sha256`).

**Workflow:**
1. `git status --short`; pick from `raw/` without moving.
2. Ingest — CSV: structured parser; PDF/image: OCR into `generated/`. Keep filename, row/page, raw desc/amount/balance.
3. Normalize → match (shape/heuristics in `references/shapes.md`). App txns for confirmed account, range ±7 d, both `account_id` and `to_account_id`. Honor `kind`/`type` for sign (card charge = expense; card payment = transfer).
4. Classify — `matched_clean | update_suggested | missing_in_app | extra_app_transaction | possible_duplicate | unclear`.
5. Emit `generated/recon-YYYY-MM-account-slug.{md,proposed-changes.json}` (+optional `.csv`). MD: counts, high-conf actions, review items, warnings (sign, unmatched transfers, missing balances, account kind mismatch).
6. Print `add N / update N / delete N / unclear N`; on explicit yes write via `app/actions/transactions.ts` (dry-run first, atomic where feasible); short post-apply summary.
