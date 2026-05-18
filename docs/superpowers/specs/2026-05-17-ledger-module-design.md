# 帳本模組設計規格

**日期：** 2026-05-17
**狀態：** 已確認，待實作

---

## 背景

Family App 目前所有 UI 邏輯集中在 `app/dashboard.tsx`（單一 34K token 檔案），資料存於 localStorage，尚未連接 Supabase。

本次目標：將「帳本」功能模組化並接上 Supabase，讓使用者可以正式開始記帳。其他模組（帳戶總覽、提醒、待辦）本次不動。

---

## 範圍

**本次做：**
- 帳本頁面（交易列表）
- 新增交易表單（支出 / 收入 / 轉帳）
- Supabase 資料庫欄位補齊
- 新增 `categories` 表，從 AndroMoney 分類預填

**本次不做：**
- AndroMoney 歷史資料匯入
- 信用卡帳單自動對帳
- 其他頁面（帳戶、提醒、待辦）重構
- 月結報表

---

## 資料庫調整

### transactions 表補充欄位

```sql
ALTER TABLE public.transactions
  ADD COLUMN merchant text,
  ADD COLUMN currency text NOT NULL DEFAULT 'TWD',
  ADD COLUMN owner text NOT NULL DEFAULT '共同',
  ADD COLUMN account_id text REFERENCES public.family_accounts(id) ON DELETE SET NULL,
  ADD COLUMN to_account_id text REFERENCES public.family_accounts(id) ON DELETE SET NULL;
```

> 注意：`family_accounts.id` 是 `text` 類型，因此 FK 欄位使用 `text`，不是 `uuid`。

`kind` enum 補上 `transfer`：
```sql
ALTER TYPE transaction_kind ADD VALUE 'transfer';
```

### 新增 categories 表

```sql
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
  icon text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  source_app text,
  source_category_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

AndroMoney 分類預填（seed data），之後使用者可自行新增。

---

## 檔案結構

```
app/
  ledger/
    page.tsx                  ← Server Component，從 Supabase 讀取交易列表
    new/
      page.tsx                ← 新增交易頁面
    _components/
      TransactionList.tsx     ← 交易列表 UI
      TransactionForm.tsx     ← 新增/編輯表單（Client Component）
      TransactionFilters.tsx  ← 月份 / 帳戶篩選
  actions/
    transactions.ts           ← Server Actions：新增、編輯、刪除交易
```

---

## 交易欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| kind | `income` / `expense` / `transfer` | 交易類型 |
| amount | number | 金額（正數） |
| currency | `TWD` / `USD` / `JPY` / `CNY` | 幣別，預設 TWD |
| category_id | uuid | 分類 |
| merchant | text | 商家名稱 |
| account_id | uuid | 使用帳戶（轉帳時為來源帳戶） |
| to_account_id | uuid | 目標帳戶（僅轉帳時使用） |
| owner | `我` / `老婆` / `共同` | 持有人 |
| occurred_on | date | 日期，預設今天 |
| note | text | 備註 |

---

## UI 設計

### 帳本主頁 `/ledger`

- 頂部：頁面標題 +「＋ 新增」按鈕
- 篩選列：月份選單、帳戶選單
- 列表：每筆交易顯示日期、商家/標題、分類、帳戶、持有人、金額（支出紅色負號、收入綠色正號、轉帳灰色）
- 按日期分組，同日多筆交易合併顯示

### 新增交易頁 `/ledger/new`

表單欄位順序（依使用頻率排列）：

1. 交易類型切換：**支出 / 收入 / 轉帳**
2. 金額 + 幣別（並排）
3. 分類（下拉，依 kind 篩選）
4. 帳戶（支出/收入：單一帳戶；轉帳：來源帳戶 → 目標帳戶）
5. 商家
6. 日期（預設今天）
7. 持有人（我 / 老婆 / 共同）
8. 備註
9. 送出按鈕

---

## 資料流

```
使用者開啟 /ledger
  → Server Component 呼叫 Supabase 讀取 transactions
  → 傳入 TransactionList 顯示

使用者點「＋ 新增」
  → 導向 /ledger/new
  → 填寫 TransactionForm
  → 送出觸發 Server Action (transactions.ts)
  → 寫入 Supabase
  → revalidatePath('/ledger')
  → 導回帳本主頁，列表自動更新
```

---

## 不在本次範圍的功能

以下功能已規劃，留待後續迭代：
- **AndroMoney 歷史資料匯入**：保留 `source_app` / `source_transaction_id` 欄位供未來使用
- **信用卡帳單自動對帳**：交易表已有 `merchant` 欄位，對帳時可比對商家名稱
- **月結報表**：分類 / 帳戶已正規化，報表查詢屆時可直接跑 SQL
