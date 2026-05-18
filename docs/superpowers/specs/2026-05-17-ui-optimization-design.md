# UI 優化設計文件 — 2026-05-17

## 目標

為 Family App 建立一致的手機優先 UI：共用底部導航、統一 Neobrutalist 視覺風格、首頁改為摘要卡片。

---

## 設計決策

| 項目 | 決策 |
|------|------|
| 導航形式 | 底部 Tab Bar |
| 視覺風格 | Neobrutalist（米黃 `#faf7f0` 底、粗黑邊框 `border-2 border-slate-950`、亮色點綴） |
| 裝置優先 | 手機優先（max-w-lg 容器，大拇指觸控友好） |
| 首頁內容 | 三張摘要卡片（淨資產 / 本月收支 / 即將提醒） |

---

## 架構

### 1. 共用 BottomNav 元件

**檔案：** `components/BottomNav.tsx`（Client Component）

- 使用 `usePathname()` 判斷當前分頁，高亮對應 tab
- 4 個 tab：首頁（`/`）、帳戶（`/accounts`）、帳本（`/ledger`）、提醒（`/reminders`）
- 樣式：白底 + 頂部 3px 粗邊框高亮當前 tab，icon + 文字標籤
- 固定在畫面底部（`fixed bottom-0`），不影響頁面 scroll

```
┌─────────────────────────────────┐
│  🏠 首頁  │ 💳 帳戶 │ 📒 帳本 │ 🔔 提醒  │
│  ▲ (active border)              │
└─────────────────────────────────┘
```

各頁面在 `<main>` 底部加 `pb-20`（80px）為 tab bar 留空間。

### 2. 首頁重寫（`app/page.tsx`）

**改為 Server Component**，不再直接渲染 `Dashboard`。

三張摘要卡片：

#### 卡片一：淨資產（藍色 `#00c2ff`）
- 資料來源：`getAccounts()` → 計算 asset total - liability total
- 顯示：淨值大數字 + 資產/負債兩格小卡
- 右下角：「→ 查看帳戶」Link

#### 卡片二：本月收支（白色）
- 資料來源：`getTransactions({ year, month })` → 加總收入/支出
- 顯示：收入/支出兩格 + 結餘進度條
- 資料匯入前顯示 `$0`（不顯示錯誤）
- 右下角：「→ 查看帳本」Link

#### 卡片三：即將到期（黃色 `#fff45f`）
- 資料來源：`reminders` 表（未來 30 天內、未完成）
- 顯示：最多 3 筆，每筆顯示名稱 + 剩餘天數 badge
- 提醒系統建好前：顯示「尚無提醒」空狀態
- 右下角：「→ 查看提醒」Link

頁面頂部：月份標題（例如「5月 概覽」）

### 3. 帳戶頁（`app/accounts/page.tsx`）

- 加入 `<BottomNav />`，加 `pb-20` 給 main
- 其餘不動（已完成 neobrutalist 風格）

### 4. 帳本頁（`app/ledger/page.tsx`）

- 從 `bg-gray-50` 改為 `bg-[#faf7f0]`（neobrutalist 底色）
- 標題列、篩選器、新增按鈕統一成粗邊框風格
- 加入 `<BottomNav />`，加 `pb-20` 給 main

### 5. 提醒頁（`app/reminders/page.tsx`）

- **本次完全不動**：仍舊渲染 Dashboard wrapper
- Dashboard 是全屏 Client Component，加 BottomNav 會版面衝突
- BottomNav 的「🔔 提醒」tab 仍可導航至 `/reminders`，只是進去後沒有底部列
- 等提醒系統正式建置時，整頁重寫並一起加入 BottomNav

---

## 元件設計細節

### BottomNav

```tsx
// components/BottomNav.tsx
'use client'
const tabs = [
  { href: '/',         icon: '🏠', label: '首頁' },
  { href: '/accounts', icon: '💳', label: '帳戶' },
  { href: '/ledger',   icon: '📒', label: '帳本' },
  { href: '/reminders',icon: '🔔', label: '提醒' },
]
```

Active 判斷：`pathname === href`（精確比對，避免 `/accounts/[id]` 也觸發帳本 tab）。

帳戶明細頁 `/accounts/[id]` 也要顯示 BottomNav（帳戶 tab 高亮）：用 `pathname.startsWith('/accounts')` 判斷。

### 首頁 Server Component 結構

```
app/page.tsx                    ← Server Component（async）
app/_components/
  NetWorthCard.tsx              ← 淨資產卡（接收 accounts[]）
  MonthlySummaryCard.tsx        ← 本月收支卡（接收 transactions[]）
  UpcomingRemindersCard.tsx     ← 即將提醒卡（接收 reminders[]）
```

---

## 不在本次範圍

- 提醒系統資料表 / UI（後續任務 C）
- AndroMoney CSV 匯入（後續任務 D）
- 帳本月結總覽卡片（後續任務 A）
- `/login`、`/signup`、`/reset-password`：不加 BottomNav

---

## 視覺規範（Neobrutalist）

| Token | 值 |
|-------|----|
| 頁面底色 | `bg-[#faf7f0]` |
| 邊框 | `border-2 border-slate-950` |
| 陰影 | `shadow-[4px_4px_0_#111827]` |
| 主色（藍） | `#00c2ff`（淨資產卡） |
| 強調色（粉） | `#ff3d9a`（主要 CTA 按鈕） |
| 強調色（黃） | `#fff45f`（提醒卡、淨值格） |
| 字體粗細 | `font-black`（標題）、`font-bold`（內容） |
