# 新對話窗交接 — 2026-05-17

## 請先讀這個

請讀 `docs/handoff-2026-05-17c.md` 了解最新進度，再繼續工作。

---

## 專案是什麼

家庭記帳與管理 PWA（Next.js 15 App Router + Supabase + Tailwind CSS）。
只有我和老婆兩人使用，不是公開產品。

**Production URL：** https://family-app-ruddy-one.vercel.app
**GitHub：** `git@github.com:okoscarkuo-netizen/family-app.git`
**Dev server：** `npm run dev`（http://localhost:3000）

---

## 今天完成了什麼

### 上午場（handoff-2026-05-17b.md）
- `/accounts` 頁面升級為 Server Component + 完整 CRUD modal
- `/ledger/new` 帳戶下拉有資料
- 分析新 AndroMoney CSV（16,353 筆，其中 3,590 筆無帳戶）

### 下午場（handoff-2026-05-17c.md）
- 全站共用 **底部 Tab Bar**（5 欄：首頁｜帳戶｜記一筆｜帳本｜提醒）
- **首頁改寫**：三張摘要卡片（淨資產/本月收支/即將到期）
- 帳本頁統一 Neobrutalist 風格
- 已部署到 Vercel

---

## 目前架構

| 路徑 | 說明 | 資料來源 |
|------|------|---------|
| `/` | 首頁（三張摘要卡片） | Supabase |
| `/accounts` | 帳戶管理（CRUD） | Supabase |
| `/accounts/[id]` | 帳戶明細 | Supabase |
| `/ledger` | 帳本（月份篩選） | Supabase |
| `/ledger/new` | 新增交易 | Supabase |
| `/reminders` | 提醒（舊 Dashboard wrapper） | localStorage |

**注意：** `/reminders` 還是舊的 Dashboard 元件，等提醒系統建置時再重寫。

---

## 重要技術細節

1. **Auth**：Passcode cookie 驗證，**沒有** Supabase Auth（不要用 supabase.auth）
2. **DB 存取**：一律用 `createAdminClient()`，可能回傳 null，要先 null check
3. **family_accounts.id**：是 text 型別，含特殊字元（如 `฿-`），URL 用 `encodeURIComponent`
4. **舊 Dashboard**（`app/dashboard.tsx`）：保留不動，`/reminders` 和 `/api/accounts` 還在用
5. **balance 欄位**：目前全部為 0，待 CSV 匯入後更新

---

## 下一步（優先順序）

### 高優先
**D. AndroMoney CSV 匯入**
- 檔案：`imports/andromoney/raw/_var_mobile_...csv`
- 編碼：Big5，16,353 筆
- 問題：3,590 筆付款/收款欄位空白（無帳戶），需先決定處理方式：
  - 選項 A：account_id 存 null（接受空白）
  - 選項 B：跳過這 3,590 筆不匯入
  - 選項 C：建一個「未分類」虛擬帳戶承接

### 中優先
**C. 提醒系統**
- 資料表已在 `supabase/schema.sql`（`bill_reminders`、`maintenance_reminders`）
- 首頁「即將到期」卡片已預留位置，目前顯示空狀態

### 低優先
**A. 帳本月結總覽**
- 首頁「本月收支」卡片目前顯示 $0（等 CSV 匯入後才有意義）

---

## 視覺規範（Neobrutalist）

| Token | 值 |
|-------|----|
| 頁面底色 | `bg-[#faf7f0]` |
| 邊框 | `border-2 border-slate-950` |
| 陰影 | `shadow-[4px_4px_0_#111827]` |
| 主色（藍） | `#00c2ff` |
| 強調色（粉） | `#ff3d9a`（主要 CTA 按鈕）|
| 強調色（黃） | `#fff45f` |
| Tab Bar | 白底毛玻璃、頂部藍陰影、粉紅 active |
