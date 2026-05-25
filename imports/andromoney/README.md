# AndroMoney Import Assets

This folder centralizes the AndroMoney materials used for the family app account import.

## Structure

- `raw/AndroMoney-export-2026-05-05.csv`: original AndroMoney CSV export moved from `~/Downloads`.
- `screenshots/IMG_6858.PNG` through `IMG_6864.PNG`: iCloud Drive screenshots of the AndroMoney account screen.
- `generated/andromoney-accounts-from-transactions.csv`: accounts inferred from transaction CSV payment/receipt columns.
- `generated/screenshot-missing-accounts.csv`: accounts visible in screenshots but missing from the transaction-derived list.
- `generated/andromoney-accounts-complete-import.csv`: merged account import file for this PWA.
- `generated/account-master-audit.csv`: reviewed master account checklist with source, suggested group, reconciliation scope, and review flags.
- `generated/account-import-ready.csv`: conservative import subset that currently has no review flags.
- `generated/account-review-needed.csv`: accounts that need manual confirmation before being treated as clean.
- `generated/account-review-high-priority.csv`: highest-priority cleanup list.
- `generated/account-reconciliation-v1-candidates.csv`: accounts that should be considered for the first reconciliation-center version.
- `generated/account-master-summary.md`: human-readable summary of the account audit.
- `scripts/build-account-master-audit.mjs`: regenerates the audit and derived CSV files from the current generated account inputs.
- `scripts/reimport-family-transactions-safe.mjs`: dry-run first, then atomically re-imports the AndroMoney transaction history back into Supabase.

Notes:
- The raw export is Big5/CP950 encoded.
- USD display uses an approximate rate inferred from screenshots.

## Safe transaction re-import

Use the safe re-import script instead of the older `full_import.py` when rebuilding `family_transactions`.

Dry run:

```bash
node imports/andromoney/scripts/reimport-family-transactions-safe.mjs
```

Apply after the dry-run looks clean:

```bash
node imports/andromoney/scripts/reimport-family-transactions-safe.mjs --apply
```

What the script does:

- Resolves the current account/category/merchant IDs from Supabase.
- Maps the 7 name variants that only differ by currency suffixes.
- Preserves current `family_accounts.balance` values by shifting each account's `opening_balance` to the correct imported base before inserting history.
- Uses a single Supabase RPC so the whole re-import is atomic.
- Aborts if it finds unresolved accounts or categories for non-zero transactions.
