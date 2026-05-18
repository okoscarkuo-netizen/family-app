# 帳戶頁升級設計規格 — 2026-05-17

## 目標
把 `/accounts` 從 `dashboard.tsx` wrapper 獨立出來，成為 Server Component，直接讀寫 Supabase `family_accounts` 表，並提供完整 CRUD。

## 範圍
- 建立獨立的帳戶列表頁（`/accounts`）與明細頁（`/accounts/[id]`）
- Modal-based 新增/編輯/封存
- 餘額顯示：目前直接顯示 `balance` 欄位值（全部為 0，待歷史資料匯入後更新）
- 保留 `app/api/accounts/route.ts`（供 dashboard.tsx 繼續使用）

## 不在範圍內
- 從 transaction 自動計算餘額（待任務 D 歷史資料匯入後實作）
- DB schema 改名（`balance` → `starting_balance` 留待餘額計算實作時一併做）
- 拆解 dashboard.tsx（獨立任務）
- 帳戶匯入 CSV 功能

## 架構

### 新建檔案
```
app/accounts/page.tsx
app/accounts/[id]/page.tsx
app/accounts/_components/NetWorthBar.tsx
app/accounts/_components/AccountGroupSection.tsx
app/accounts/_components/AccountCard.tsx
app/accounts/_components/AccountModal.tsx
app/actions/accounts.ts
lib/accounts-db.ts
```

### 修改檔案
- `lib/accounts.ts` — 確保 `accountToRow` / `accountFromRow` 跟新 Server Actions 相容
- `lib/finance/types.ts` — 無需修改（型別已完整）

## 資料層

### `lib/accounts-db.ts`
```ts
getAccounts(): Promise<FamilyAccount[]>
  // SELECT * FROM family_accounts WHERE is_archived = false ORDER BY sort_order, created_at

getAccountById(id: string): Promise<FamilyAccount | null>
  // SELECT * FROM family_accounts WHERE id = $1 AND is_archived = false
```

使用 `createAdminClient()`，若回傳 null 則回傳空陣列 / null（不拋錯）。

## Server Actions（`app/actions/accounts.ts`）

### `createAccount(formData: FormData)`
- 驗證：名稱必填、balance ≥ 0、currency ∈ {TWD, USD, JPY, CNY}、kind ∈ {asset, liability}
- sort_order = 目前最大值 + 1
- INSERT INTO family_accounts
- revalidatePath('/accounts')

### `updateAccount(id: string, formData: FormData)`
- 同上驗證
- UPDATE family_accounts WHERE id = $1
- revalidatePath('/accounts')
- revalidatePath(`/accounts/${id}`)

### `archiveAccount(id: string)`
- UPDATE family_accounts SET is_archived = true WHERE id = $1
- revalidatePath('/accounts')

## 元件設計

### `app/accounts/page.tsx`（Server Component）
- 呼叫 `getAccounts()`
- 計算：assetTotal、liabilityTotal、netWorth（依 kind 加總，幣別全視為同單位，之後再做匯率）
- 渲染 `<NetWorthBar>` + 7 個 `<AccountGroupSection>`
- 傳入 `<AccountModal>` 的觸發 props（新增按鈕）

### `NetWorthBar`（Client Component）
- 顯示三格：資產總計 / 負債總計 / 淨值
- 幣別：預設 TWD，幣別混用時標註「多幣別混算，僅供參考」

### `AccountGroupSection`（Client Component）
- 接收 group 名稱 + 該組帳戶陣列
- 可折疊（預設展開）
- 每個帳戶渲染 `<AccountCard>`

### `AccountCard`（Client Component）
- 顯示：帳戶名稱、type tag、幣別、balance、owner badge
- 點擊整張卡 → navigate 到 `/accounts/[id]`
- 右上角鉛筆 icon → 開 AccountModal（edit mode）

### `AccountModal`（Client Component）
- Props：`mode: 'create' | 'edit'`、`account?: FamilyAccount`、`onClose`
- 欄位：
  - 名稱（text, required）
  - 類型（select: accountTypes）
  - 幣別（select: TWD/USD/JPY/CNY）
  - 歸屬（select: 我/老婆/共同）
  - 性質（radio: 資產/負債）
  - 起始餘額（number, ≥ 0）
  - 隱藏（checkbox）
- Edit mode 額外顯示「封存帳戶」按鈕（呼叫 archiveAccount）
- 送出後 `router.refresh()` 刷新 Server Component 資料

### `app/accounts/[id]/page.tsx`（Server Component）
- 呼叫 `getAccountById(id)`，找不到顯示 404 訊息
- 顯示帳戶基本資訊卡片
- 顯示該帳戶交易列表（從 `family_transactions` 讀，目前預期為空）
- 返回按鈕 → `/accounts`

## 樣式規範
- 沿用現有設計語言（neobrutalism：border-2 border-slate-950、shadow-[N_N_0_color]、Tailwind 4）
- 主色：`#00c2ff`（帳戶藍，沿用 dashboard.tsx 的帳戶 section 顏色）

## 驗收條件
1. `/accounts` 顯示所有未封存帳戶，按7個分組排列
2. 新增帳戶 → 出現在列表
3. 編輯帳戶 → 資料更新
4. 封存帳戶 → 從列表消失
5. `/accounts/[id]` 顯示帳戶資訊
6. `/ledger/new` 的帳戶下拉有資料（因 accounts 已在 Supabase）
