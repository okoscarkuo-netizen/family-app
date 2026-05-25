# 財務與帳戶模型設計

這份文件定義家庭 App 的記帳核心規則。目標是讓本 App 能承接 AndroMoney 與隨手記的帳戶習慣，同時建立更清楚、可追溯、可同步的資料模型。

## 目前假設

- 本 App 是家庭共用，不是單人記帳本；資料需要支援「我」、「老婆」、「共同」三種持有或責任歸屬。
- 帳戶不只是付款工具，也包含資產、負債、信用卡、投資、押金、保險、車輛、房地產與代刷墊款。
- 目前已有 AndroMoney 匯入素材：
  - `imports/andromoney/raw/AndroMoney-export-2026-05-05.csv`
  - `imports/andromoney/generated/andromoney-accounts-complete-import.csv`
  - `imports/andromoney/screenshots/`
- 原始 AndroMoney 匯出檔為 Big5/CP950 編碼，匯入流程必須保留原始欄位。
- 現有前端 `app/dashboard.tsx` 已有帳戶、記帳、轉帳、匯入的雛形，但仍是 localStorage 狀態，不是正式帳本模型。
- 目前 `supabase/schema.sql` 只有簡化版 `transactions.kind = income | expense`，不足以支援轉帳、信用卡負債、月結、資產負債表與舊資料匯入。

## 帳戶架構

帳戶應採用「大類 + 子類 + 持有人 + 幣別 + 性質」的模型。不要只用 `type` 字串判斷。

### 帳戶性質

- `asset`：資產帳戶，餘額增加代表資產增加。
- `liability`：負債帳戶，餘額增加代表欠款增加。
- `equity`：淨值或調整帳戶，先保留，日後可用於期初導入與資產重估。

### 帳戶大類

建議的帳戶群組：

- 銀行與活儲：薪轉戶、Checking、Saving、一般銀行帳戶。
- 現金與儲值：家庭現金、US 現金、電子錢包、E-Tag、禮券、紅利金。
- 信用卡：每張卡是一個負債帳戶，若 AndroMoney 匯入出現正負混用，匯入時保留原始符號並建立校正欄位。
- 投資：股票、證券、IRA、401K、Crypto、Schwab、MooMoo、IB。
- 房貸與負債：房貸、信貸、私人借款、Buffer、代墊應付款。
- 實物資產與保險：房地產、車輛、保單價值、押金。
- 代刷墊與暫付款：代刷、代墊、應收應付往來。

### 帳戶欄位草案

```text
accounts
- id
- household_id
- name
- display_name
- account_group
- account_type
- normal_side: asset | liability | equity
- owner: me | wife | shared | external
- currency
- opening_balance
- opening_balance_date
- current_balance_snapshot
- include_in_net_worth
- is_archived
- source_app
- source_account_name
- source_account_uid
- notes
- created_at
- updated_at
```

### 命名規則

保留原始帳戶名稱，不急著美化覆蓋。

- `name`：系統唯一名稱，可沿用匯入名稱。
- `display_name`：未來 UI 顯示用，可逐步整理。
- `source_account_name`：AndroMoney 或隨手記原始名稱。

例如：

```text
source_account_name = ₵-彥伶-富邦數位卡
display_name = 彥伶 富邦數位卡
account_group = 信用卡
normal_side = liability
owner = wife
currency = TWD
```

## 分類架構

分類要和帳戶分開。帳戶回答「錢從哪裡來、到哪裡去」，分類回答「這筆交易是什麼用途」。

### 分類大類

- 收入：薪資、獎金、利息、投資收入、退款、其他收入。
- 生活支出：餐飲、交通、家庭用品、育樂、醫療、教育、服飾。
- 固定帳單：房貸、電信、水電瓦斯、保險、訂閱。
- 資產支出：車輛、房屋、設備、保養。
- 財務成本：利息、手續費、匯差。
- 內部移轉：不計入收入支出，只用於轉帳顯示與查詢。
- 匯入待整理：舊資料尚未對應完成時暫存。

### 分類欄位草案

```text
categories
- id
- household_id
- parent_id
- name
- kind: income | expense | transfer | adjustment
- icon
- color
- sort_order
- is_archived
- source_app
- source_category_name
```

## 收入、支出、轉帳規則

核心原則：一筆真實事件可以產生一筆 `transactions`，再由多筆 `ledger_entries` 影響帳戶餘額。這樣才能處理信用卡、轉帳、拆帳、匯差與資產調整。

### 交易類型

- `income`：收入，增加資產或減少負債。
- `expense`：支出，減少資產或增加負債。
- `transfer`：帳戶間移轉，不列入收入支出。
- `adjustment`：期初、校正、資產重估、匯率調整。
- `debt_payment`：負債還款，本質通常是轉帳，可用交易子類標記。
- `refund`：退款，連回原支出或作為收入型調整。

### 帳戶影響規則

資產帳戶：

- 收入：餘額增加
- 支出：餘額減少
- 轉入：餘額增加
- 轉出：餘額減少

負債帳戶：

- 信用卡刷卡或借款：餘額增加
- 信用卡繳款或還款：餘額減少
- 負債轉移：依來源與目的帳戶方向調整

### 必須避免的錯誤

- 信用卡刷卡已經記為支出，繳信用卡款不能再記一次支出。
- 轉帳不能列入本月支出或收入。
- 期初餘額不應混在日常收入裡。
- 投資帳戶市值變動不一定是現金流，應用 `adjustment` 或獨立投資事件表示。

## 信用卡規則

信用卡必須視為負債帳戶，而不是付款方式字串。

### 刷卡

刷卡買東西：

```text
transaction.kind = expense
category = 餐飲 / 交通 / 家庭用品 ...
ledger_entries:
- 借方：支出分類
- 貸方：信用卡負債增加
```

在簡化 UI 裡可表現為：

```text
支出 1,280
分類：餐飲
帳戶：共同信用卡
結果：本月支出 +1,280，信用卡應付 +1,280
```

### 繳信用卡

從銀行繳信用卡：

```text
transaction.kind = transfer
from_account = 銀行帳戶
to_account = 信用卡帳戶
ledger_entries:
- 銀行資產減少
- 信用卡負債減少
```

在報表上：

- 不增加本月支出
- 不增加收入
- 只改變資產與負債結構
- 可顯示在「信用卡付款」或「債務還款」查詢中

### 信用卡退款

退款回信用卡：

```text
transaction.kind = refund
linked_transaction_id = 原刷卡交易
ledger_entries:
- 信用卡負債減少
- 對應支出分類沖回
```

若找不到原始交易，先放入「退款 / 匯入待整理」。

### 信用卡正餘額

部分 AndroMoney 匯入資料可能讓信用卡呈現 `asset` 或正餘額。匯入時不要直接丟掉，先記錄：

- 原始帳戶性質
- 原始餘額符號
- 推定帳戶性質
- 是否需要人工確認

若信用卡實際為溢繳，仍可允許短期資產餘額，但帳戶本質仍是信用卡負債帳戶。

## 月結、帳單與餘額計算

### 餘額計算原則

正式版本應以流水推導餘額：

```text
current_balance = opening_balance + sum(ledger_entries for account)
```

`current_balance_snapshot` 只能作為快取或匯入對帳，不應取代流水。

### 月結

每月應計算：

- 月初淨資產
- 月末淨資產
- 本月收入
- 本月支出
- 本月轉帳總額
- 信用卡新增應付
- 信用卡已繳金額
- 負債本金減少
- 投資與資產重估

### 帳單提醒

帳單提醒不是支出本身。它代表「預計要發生或要確認的付款」。

帳單流程：

1. 建立 `bill_reminder`
2. 到期前提醒
3. 使用者標記付款
4. 系統產生交易
5. 若是信用卡帳單，交易類型為 `transfer` 或 `debt_payment`

## 舊資料匯入與轉換策略

匯入原則：先保存，再轉換，再校正。

### 匯入階段

1. 保存原始檔案
   - 不修改 `imports/andromoney/raw/AndroMoney-export-2026-05-05.csv`
   - 保留 Big5/CP950 編碼資訊

2. 建立原始暫存表
   - 每一列保留原始欄位
   - 增加 `source_row_number`
   - 增加 `source_app = andromoney`

3. 建立帳戶對應表
   - 原始帳戶名稱
   - 推定帳戶大類
   - 推定資產/負債性質
   - 幣別
   - 持有人
   - 是否需要人工確認

4. 建立分類對應表
   - 原始分類
   - 本 App 分類
   - 是否已確認

5. 產生正式交易與 ledger entries

### 匯入資料表草案

```text
import_batches
- id
- household_id
- source_app
- source_file_name
- encoding
- imported_at
- notes

import_raw_rows
- id
- batch_id
- row_number
- raw_payload
- parsed_payload
- status: pending | mapped | skipped | error
- error_message

import_account_mappings
- id
- batch_id
- source_account_name
- source_account_uid
- target_account_id
- inferred_group
- inferred_normal_side
- inferred_owner
- inferred_currency
- needs_review

import_category_mappings
- id
- batch_id
- source_category_name
- target_category_id
- target_kind
- needs_review
```

### 目前匯入檔案觀察

`imports/andromoney/generated/andromoney-accounts-complete-import.csv` 已整理出 105 個帳戶列，包含：

- 台灣與美國銀行帳戶
- 多張台灣與美國信用卡
- LineBank 信貸與房貸
- 投資帳戶與退休帳戶
- 現金、電子錢包、禮券、押金
- 房地產、車輛、保險
- Buffer、代刷墊、親友負債帳戶

這代表本 App 的帳戶模型必須支援多幣別、資產負債、實物資產與代墊往來，不能只做「現金/銀行/信用卡」三類。

## Supabase 正式資料表草案

目前 `supabase/schema.sql` 應升級為帳戶制模型。建議核心表：

```text
households
household_members
accounts
categories
transactions
ledger_entries
bill_reminders
maintenance_reminders
todos
import_batches
import_raw_rows
import_account_mappings
import_category_mappings
```

### transactions

```text
transactions
- id
- household_id
- created_by
- kind: income | expense | transfer | adjustment | refund
- title
- category_id
- occurred_on
- amount
- currency
- merchant
- note
- linked_transaction_id
- source_app
- source_transaction_id
- import_batch_id
- created_at
- updated_at
```

### ledger_entries

```text
ledger_entries
- id
- transaction_id
- account_id
- direction: debit | credit
- amount
- currency
- exchange_rate_to_twd
- amount_twd
- memo
- created_at
```

初期若不實作完整借貸法，至少也要有：

```text
transaction_account_entries
- id
- transaction_id
- account_id
- role: source | destination | payment | liability | adjustment
- amount_delta
- currency
```

其中 `amount_delta` 對該帳戶的餘額影響直接表示為正負數。這比只在 transaction 放一個 account_id 更安全。

## UI 實作順序

建議下一步按照這個順序做：

1. 帳戶模型升級
   - 把 `FamilyAccount` 從簡單 `type/kind` 改成正式分組欄位。
   - 匯入時標記 `needsReview`。

2. 交易模型升級
   - 加入 `income | expense | transfer | adjustment | refund`。
   - 交易不直接只存 `amount`，要能表示影響哪些帳戶。

3. 信用卡付款流程
   - 「刷卡」和「繳卡費」分開。
   - 繳卡費使用轉帳流程，不列入支出。

4. 匯入檢查畫面
   - 顯示 AndroMoney 帳戶對應。
   - 讓使用者確認帳戶大類、持有人、幣別、資產/負債。

5. 月結總覽
   - 本月收入、本月支出、轉帳、負債變動、淨資產變動分開。

## 開放問題

- 信用卡帳戶在 AndroMoney 匯入檔中部分被標示為 `asset`，需要確認這是溢繳、匯入推定錯誤，還是原 App 的顯示習慣。
- 投資帳戶要先記現金流，還是同時追蹤市值？建議第一版先支援餘額與市值快照，不急著做股價同步。
- 房地產、車輛、保險價值是手動估值還是匯入固定值？建議第一版使用手動估值與調整交易。
- 代刷墊與 Buffer 要視為應收資產、應付負債，還是家庭內部暫存帳？需要依使用習慣確認。

## 下一步

建議下一個實作任務是「把現有 dashboard 的帳戶型別升級成正式財務模型」，但先只做前端資料結構與 UI 顯示，不立刻改 Supabase schema。

第一個可執行範圍：

- 新增 `lib/finance/types.ts`
- 定義 `AccountGroup`、`AccountNormalSide`、`AccountOwner`、`TransactionKind`
- 讓 `app/dashboard.tsx` 使用這些型別
- 把現有 `accountGroup()` 的字串判斷收斂成明確 mapping
- 保留目前 localStorage，避免一次改太多造成資料遺失
