---
name: family-bank-reconciliation
description: Use when reconciling bank, credit-card, loan, or brokerage statements for the Family_App project. Original statement files live in imports/reconciliation/raw and must stay read-only. Before the first analysis of any statement file, confirm which Family_App account it belongs to, then compare the statement to family_transactions/family_accounts and produce reviewable add/update/delete/category suggestions without applying changes automatically.
---

# Family Bank Reconciliation

## Paths
- Project root: `/Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App`
- Raw (read-only, append-only): `imports/reconciliation/raw/`
- Derived output: `imports/reconciliation/generated/`
- Shapes & field reference: `imports/reconciliation/references/shapes.md` (read on demand)
- App tables: `family_accounts`, `family_transactions`, `family_categories`, `family_merchants`, `family_ledger_entries`

## Hard Rules
1. Never modify anything inside `raw/` (no delete/rename/move/rewrite/OCR-output/sidecar).
2. All derived files → `generated/`. Never commit `raw/` or `generated/`.
3. No Supabase writes (insert/update/delete) until user explicitly approves the specific batch.

## First-Time Question (per statement file)
1. Check `generated/statement-account-map.json`. If file already mapped, skip.
2. Otherwise list active `family_accounts` (`id`, `name`, `type`, `owner`, `kind`, `currency`) and ask: `這份帳單要對應 Family App 裡的哪一個帳戶？`
3. After confirmation, append mapping keyed by `filename + size + mtime` (+ optional `sha256`).

## Workflow
1. **Preflight** — `git status --short`; pick files from `raw/` without moving.
2. **Ingest** — CSV: structured parser. PDF/image: extract/OCR into `generated/`, never beside raw. Preserve filename, row/page, raw description, raw amount, raw balance.
3. **Normalize → Match** — Per-row shape and matching heuristics: see `references/shapes.md`. Pull app transactions for the confirmed account, statement range ±7 days, both `account_id` and `to_account_id`. Respect account `kind`/`type` for sign (credit card charge = expense; card payment = transfer).
4. **Classify findings** — `matched_clean` / `update_suggested` / `missing_in_app` / `extra_app_transaction` / `possible_duplicate` / `unclear`. Deletions are never auto: prefer `extra_app_transaction`.
5. **Emit review package** to `generated/` as `recon-YYYY-MM-account-slug.{md,proposed-changes.json}` (+ optional `.csv`). MD includes: counts, high-confidence actions, items needing review, warnings (sign ambiguity, unmatched transfers, missing balances, account kind mismatch).
6. **Apply only after approval** — Print `add N / update N / delete N / unclear N`, get explicit yes, then write via `app/actions/transactions.ts` (dry-run first, atomic where feasible). Emit short post-apply summary.

## On-demand details
- JSON shapes (normalized row, proposed-changes), AI completion field hints, sample household-task notes → `imports/reconciliation/references/shapes.md`.
