# Reconciliation Shapes & Reference

```ts
type Finding = 'matched_clean'|'update_suggested'|'missing_in_app'|'extra_app_transaction'|'possible_duplicate'|'unclear';

type NormalizedRow = {
  statement_file: string; source_ref: string;
  posted_on: string|null; transaction_on: string|null;
  description_raw: string; merchant_guess: string|null;
  amount: number; direction: 'inflow'|'outflow'|'unknown'; currency: string;
  balance_after: number|null; reference: string|null; memo: string|null;
};

type ProposedChanges = {
  version: 1;
  statement: { file: string; confirmed_account_id: string; confirmed_account_name: string };
  summary: Record<Finding, number>;
  changes: Array<{
    type: Finding; confidence: 'high'|'medium'|'low';
    reason: string; statement_ref: string; app_transaction_id: string|null;
    proposed_transaction: {
      kind: 'income'|'expense'|'transfer';
      title: string; amount: number; currency: string;
      account_id: string; to_account_id: string|null;
      category_id: string|null; merchant: string|null;
      owner: 'Oscar'|'Livia';
      occurred_on: string; occurred_at: string; note: string|null;
    };
  }>;
};
```

**Matching:** amount · date (0–3 d, up to 7 d delayed) · merchant similarity · ref/check/ACH/card IDs · transfer counterpart · running balance.
**AI completion (suggest):** category & parent · merchant & group · owner · account/transfer counter · notes for `報稅相關`/`固定支出`/`訂閱`/`HOA`/`車子保養`/`房屋維護`/`濾芯`/`冷氣保養` · recurring-task candidates.
**App tables:** `family_accounts`, `family_transactions`, `family_categories`, `family_merchants`, `family_ledger_entries`.
