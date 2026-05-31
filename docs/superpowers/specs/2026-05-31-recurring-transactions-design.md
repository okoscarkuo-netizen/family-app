# 定期交易（Recurring Transactions）設計規格

**日期**：2026-05-31
**分支**：feat/reminders-upgrade
**狀態**：已核准，待實作
**Mockup**：`/preview/recurring`（家庭 App preview 路由）

---

## 目標

讓使用者設定「每月薪水」「Netflix 訂閱」「房貸」「分期付款」等定期重複的金流，到日自動產生交易記錄，免去手動每月記帳。

---

## 範圍決策（透過 brainstorming 與使用者確認）

| 項目 | 決策 |
|---|---|
| 整合方式 | **整合進「記一筆」表單**，加一個隱藏式「＋ 週期」標籤；管理頁放「更多」 |
| 產生機制 | **自動產生**，使用者可事後修改 |
| 頻率支援 | 基本四種：每週 / 每月 / 每季 / 每年 |
| 結束條件 | 可選「一直重複」或「共 N 次為止」 |
| 交易類型 | 支援收入、支出、轉帳三種 |
| 流水帳識別 | **不加**特殊標籤（自動產生的交易跟手動記的長一樣） |
| 首頁提醒 | **不加**「下週將扣款」卡片 |

---

## 一、資料模型

### 1.1 新表 `recurring_transactions`

定期交易的「模板」/「規則」。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | 名稱（如「Netflix 訂閱」、「Oscar 月薪」） |
| `kind` | text | `income` / `expense` / `transfer` |
| `amount` | numeric | 金額 |
| `currency` | text | TWD / USD / JPY |
| `account_id` | uuid FK | 主要帳戶（支出來源 / 收入入帳） |
| `target_account_id` | uuid FK nullable | 轉帳目的帳戶（kind=transfer 才有） |
| `target_amount` | numeric nullable | 轉帳目的金額（跨幣別） |
| `target_currency` | text nullable | 轉帳目的幣別 |
| `category_id` | uuid FK nullable | 分類 |
| `merchant_id` | uuid FK nullable | 商家 |
| `owner` | text | Oscar / Livia |
| `frequency` | text | `weekly` / `monthly` / `quarterly` / `yearly` |
| `start_date` | date | 第一次扣款日（=表單上的日期） |
| `next_due_date` | date | 系統維護：下次該產生的日期 |
| `end_type` | text | `forever` / `count` |
| `end_count` | int nullable | 結束次數（end_type=count 才有） |
| `generated_count` | int | 系統維護：已產生幾筆 |
| `is_active` | bool | 暫停/啟用開關（預設 true） |
| `notes` | text nullable | 備註 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 1.2 修改現有表 `family_transactions`

加一欄：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `recurring_id` | uuid FK nullable | 指回模板。手動記的交易為 NULL，自動產生的指向對應模板 |

> **重要**：自動產生的交易進入 `family_transactions` 後就是「獨立記錄」，編輯/刪除它不影響模板。

---

## 二、自動產生機制

### 2.1 Vercel Cron

新增 `/api/cron/recurring-transactions` API：

- **排程**：每天 PT 07:00（Phoenix 早上）跑一次
- **vercel.json** 加 cron 設定

### 2.2 產生邏輯

```
對每一筆 is_active=true 的 recurring_transactions：
  while next_due_date <= today：
    1. 在 family_transactions 寫一筆交易：
       - occurred_on = next_due_date（不是 today！）
       - recurring_id = 這個模板的 id
       - 其他欄位從模板複製
    2. 同步更新帳戶餘額（沿用現有交易建立的 side effect）
    3. generated_count += 1
    4. 若 end_type=count 且 generated_count >= end_count：
       - is_active = false
       - break
    5. next_due_date = next_due_date + 一個 frequency 區間
  存回 recurring_transactions
```

**漏跑保護**：迴圈確保即使 cron 中斷 3 天，第 4 天會把那 3 筆都補上，且每筆日期是「原本應該產生的那天」，不是 today。

### 2.3 下一次日期計算規則

| frequency | 算法 |
|---|---|
| weekly | `next_due + 7 天` |
| monthly | `next_due + 1 個月`。若該月不存在這個日（如 1/31 + 1 月 = 2/?），用「該月最後一天」 |
| quarterly | `next_due + 3 個月`（同上規則） |
| yearly | `next_due + 1 年`。閏年 2/29 跳到下年 2/28 |

---

## 三、UI 規劃

### 3.1 記一筆表單（`TransactionForm.tsx`）

底部備註欄下方加一個小標籤：

**狀態 A（未開啟）**：

```
... 既有欄位 ...
備註：（空）
[＋ 週期]    ← 小的虛線 chip，按下展開
─────────
[儲存]
```

**狀態 B（已開啟）**：

```
... 既有欄位 ...
備註：（空）
─────────
🔁 週期設定                              [移除]
頻率：[每週] [每月✓] [每季] [每年]
結束方式：◉ 一直重複
        ○ 共 [12] 次
下次自動產生：2026/06/30
─────────
[儲存]
```

### 3.2 儲存行為

#### 新增模式

- 週期關閉 → 跟現在一樣，建一筆交易
- 週期開啟 →
  1. 建一筆交易（日期 = 表單上的日期 = `start_date`）
  2. 建一筆 `recurring_transactions` 模板：
     - `start_date` = 表單日期
     - `generated_count` = 1（剛才那筆算第一次）
     - `next_due_date` = `start_date` + 一個 frequency 區間

#### 編輯模式（編輯已有的定期交易模板）

- 從「定期交易」管理頁點「編輯」進來
- 表單預填模板資料，週期已開啟
- 修改只影響**未來**產生的交易
- 過去已產生的交易不動

### 3.3 「更多」頁加入口

`app/more/page.tsx` 的「常用入口」加一項：

```
定期交易 — 管理已建立的定期規則
```

### 3.4 定期交易管理頁 `/recurring`

新增路由 `app/recurring/page.tsx`：

**列表卡片**（每張卡）：

- 名稱（如 Netflix 訂閱）
- 狀態標籤：啟用中 / 已暫停
- 頻率 + 日（如「每月 5 號」）
- 金額（收入綠色 / 支出黑色）
- 分類 · 帳戶
- 下次：日期 · 已記 N 筆
- 三個按鈕：暫停/啟用、編輯、刪除

**操作**：

- 暫停 → `is_active = false`，next_due_date 保留
- 啟用 → `is_active = true`，自動補產生漏掉的（呼叫一次同樣的 cron 邏輯）
- 編輯 → 開啟 `TransactionForm` 編輯模式，欄位預填
- 刪除 → 跳確認 → 刪除模板，**保留**過去已產生的交易

---

## 四、邊界處理

| 情境 | 處理 |
|---|---|
| 編輯規則改了金額 | 只影響未來，過去已產生不動 |
| 暫停某個定期 | `is_active=false`、`next_due_date` 保留；恢復後從那天繼續並補產生漏掉的 |
| 「共 N 次」用完 | 自動 `is_active=false` |
| 想跳過下個月一次 | 進管理頁 → 編輯 → 手動把 `next_due_date` 推到下下個月 |
| 該扣款日不存在（如 2/30）| 用該月最後一天 |
| 帳戶被封存（is_archived=true）| 該模板自動 `is_active=false`，並在管理頁顯示「帳戶已封存」狀態 |
| 跨幣別轉帳（USD → TWD）| 沿用既有 `transfer` 跨幣別欄位（`target_amount`、`target_currency`） |
| 起始日期未來（如預設下個月才開始）| 第一次扣款日 = 該未來日，cron 到日才產生（不立刻建交易） |

---

## 五、修改清單

### 5.1 DB Migration

新增 SQL migration：

1. `CREATE TABLE recurring_transactions ...`
2. `ALTER TABLE family_transactions ADD COLUMN recurring_id uuid`
3. 加 index：`recurring_transactions(is_active, next_due_date)`

### 5.2 Server Actions

新增 `app/actions/recurring.ts`：

- `createRecurringTransaction(input)`
- `updateRecurringTransaction(id, input)`
- `deleteRecurringTransaction(id)`
- `toggleRecurringTransaction(id, isActive)`

修改 `app/actions/transactions.ts`：

- `createTransaction` 接受可選的 `recurringConfig` 參數
  - 若有 → 同時建模板與第一筆交易（DB transaction 包起來）
- `updateTransaction` 若交易連結到 recurring 模板，且使用者改了「週期設定」→ 同步更新模板

### 5.3 DB Helper

新增 `lib/recurring-db.ts`：

- `getRecurringTransactions()` — 列表（含 `account_name`、`category_name`、`merchant_name` join）
- `getRecurringTransactionById(id)`
- `computeNextDueDate(date, frequency)` — 算下次日期（含月底邊界處理）
- `generateDueRecurringTransactions()` — Cron 主要邏輯

### 5.4 UI 元件

**修改**：

- `app/ledger/_components/TransactionForm.tsx` — 加「＋ 週期」chip 與展開區塊
- `app/more/page.tsx` — 加「定期交易」入口

**新增**：

- `app/recurring/page.tsx` — 管理頁
- `app/recurring/_components/RecurringList.tsx` — 列表卡片
- `app/recurring/_components/RecurringCard.tsx` — 單張卡片
- `app/recurring/loading.tsx` — Loading skeleton

### 5.5 Cron API

新增 `app/api/cron/recurring-transactions/route.ts`，呼叫 `generateDueRecurringTransactions()`。

### 5.6 設定 `vercel.json`

加 cron 排程：

```json
{
  "crons": [
    { "path": "/api/cron/recurring-transactions", "schedule": "0 14 * * *" }
  ]
}
```

（14:00 UTC = 07:00 Phoenix）

---

## 六、不在本次範圍

- 不做首頁「下週將扣款」卡片
- 不做流水帳 🔁 識別圖示
- 不做進階頻率（每 N 月、月底、第幾個星期 X）
- 不做推播通知（PWA push）
- 不做與「家事提醒」系統的整合（兩者保持獨立）

---

## 七、成功標準

1. 在「記一筆」勾選週期、設定月薪 NT$80,000 每月 28 號，**儲存**
2. 流水帳出現 5/31 那筆 NT$80,000 交易
3. 「更多」→「定期交易」看得到一張卡片「Oscar 月薪 / 每月 28 號 / 下次 6/28」
4. 6/28 cron 自動跑後，流水帳新增一筆 6/28 的 NT$80,000 交易
5. 該交易的 `recurring_id` 欄位指向模板
6. 編輯模板把金額改成 NT$85,000，6/28 之前的舊紀錄不變、7/28 之後自動用新金額
7. 點「暫停」後，cron 不再為該模板產生交易
8. 設「共 12 次」的車貸跑完 12 次後自動暫停
9. `npm run check` 通過

---

## 八、Mockup 對照

完整視覺請見 production 預覽頁：
**https://family-app-ruddy-one.vercel.app/preview/recurring**
