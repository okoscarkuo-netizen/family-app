# Reconciliation Shapes & Field Reference

Read this only when actively running a reconciliation. The main SKILL.md does not need it for trigger detection.

## Normalized Statement Row
```json
{
  "statement_file": "original filename",
  "source_ref": "row/page reference",
  "posted_on": "YYYY-MM-DD or null",
  "transaction_on": "YYYY-MM-DD or null",
  "description_raw": "raw bank text",
  "merchant_guess": "normalized merchant or null",
  "amount": 0,
  "direction": "inflow|outflow|unknown",
  "currency": "USD|TWD|JPY",
  "balance_after": null,
  "reference": null,
  "memo": null
}
```

## Matching heuristics
Score candidates using:
- exact or near-exact amount match
- date distance, usually 0-3 days, up to 7 days for known delayed posting
- normalized merchant/description similarity
- reference/check/ACH/card identifiers
- transfer counterpart evidence in another account
- running balance consistency when statement provides balances

## Proposed Change Shape
```json
{ "version": 1,
  "statement": { "file": "filename.csv", "confirmed_account_id": "…", "confirmed_account_name": "…" },
  "summary": { "matched_clean": 0, "update_suggested": 0, "missing_in_app": 0, "extra_app_transaction": 0, "possible_duplicate": 0, "unclear": 0 },
  "changes": [
    { "type": "missing_in_app", "confidence": "high|medium|low", "reason": "…",
      "statement_ref": "row/page", "app_transaction_id": null,
      "proposed_transaction": {
        "kind": "income|expense|transfer", "title": "…", "amount": 0, "currency": "USD",
        "account_id": "…", "to_account_id": null, "category_id": null, "merchant": null,
        "owner": "Oscar", "occurred_on": "YYYY-MM-DD", "occurred_at": "ISO", "note": null
      } }
  ] }
```

## AI completion field hints (suggest, don't auto-apply)
- category & parent category
- merchant display name & merchant group
- owner (`Oscar` or `Livia`)
- account or transfer counter-account
- notes for known buckets: `報稅相關`, `固定支出`, `訂閱`, `HOA`, `車子保養`, `房屋維護`, `濾芯`, `冷氣保養`
- recurring-task candidates when a financial row implies a household reminder
