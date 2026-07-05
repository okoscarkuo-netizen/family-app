# Family App 自動備份功能 — 設計文件

- 日期：2026-06-04
- 作者：Claude（與 Oscar 對談蒸餾）
- 狀態：草稿，等待使用者複核

---

## 1. 目標

每隔一段時間（雙週或每月）自動把 Family App 全部資料打包成 Excel，寄到 Oscar 的 Gmail，作為**純資料保險**。
另提供「立即備份」按鈕，可隨時手動觸發一次。

非目標：
- 不做自動還原（Excel 主要給人眼讀，未來真要還原可手動參照 ID 重建）
- 不做漂亮報表（不是給會計或對外用）
- 不做差異備份（每次都是完整快照）

成功標準：
- `/more/backup` 頁可看到目前頻率（雙週/每月）、上次寄送時間、下次寄送時間、立即備份按鈕。
- 切換頻率後 UI 立即反映、下次寄送日期重算正確。
- 按「立即備份」3 秒內收到 Gmail，附件 Excel 8 個分頁資料完整。
- Vercel cron 每週五觸發，依設定的頻率決定要不要實際寄出。
- 從 `2026-06-12` 起作為雙週備份的錨點（anchor），第一次自動寄送日就是這天。

---

## 2. 使用者流程

### 2.1 設定頁面（`/more/backup`）

頁面元件：
- 頻率切換（雙週 / 每月）— 兩個按鈕，目前的高亮
- 「下次寄送：YYYY-MM-DD（週五）」
- 「上次寄送：YYYY-MM-DD HH:mm」或「尚未寄送」
- 「寄送到：ok.oscar.kuo@gmail.com」
- 「立即備份（寄出）」主按鈕
- 說明區（每兩週 / 每月 的定義、Excel 內容概要）

行為：
- 切換頻率 → 寫入 `family_backup_config.schedule`，UI 重算「下次寄送日」。
- 按「立即備份」→ 跑備份 → 跑完顯示「✅ 已寄出 X MB 到 …」或紅字錯誤訊息。
- 3 分鐘內重按「立即備份」會被阻擋（防誤觸雙寄）。

### 2.2 自動寄送流程

```
Vercel Cron（每週五 14:00 UTC = Phoenix 07:00）
  → GET /api/cron/backup（Bearer CRON_SECRET 驗證）
  → 讀 family_backup_config
  → shouldSendToday(today, config)？
      biweekly：(today - anchor) % 14 == 0 且 today 是週五
      monthly：today 是當月第一個週五
  → 不是該寄的日子 → return { skipped: true }
  → 是 → runBackup()
      抓全部 8 張表
      ExcelJS 產生 .xlsx Buffer
      Nodemailer 透過 Gmail SMTP 寄出
      更新 family_backup_config.last_sent_at
  → log 結果到 Sentry / console
```

---

## 3. 架構

### 3.1 新檔案

| 檔案 | 職責 |
|------|------|
| `lib/backup/excel.ts` | 抓 8 張表的資料 + ExcelJS 產生 Buffer |
| `lib/backup/mailer.ts` | Nodemailer + Gmail SMTP 包裝 |
| `lib/backup/schedule.ts` | `shouldSendToday()` / `nextSendDate()` 純函式邏輯 |
| `lib/backup/config-db.ts` | 讀/寫 `family_backup_config` |
| `lib/backup/run-backup.ts` | 串起來的 orchestrator，給 cron 跟手動按鈕共用 |
| `app/api/cron/backup/route.ts` | Vercel Cron 入口（CRON_SECRET 驗證、呼叫 run-backup） |
| `app/more/backup/page.tsx` | 備份專頁（Server Component，抓設定） |
| `app/more/backup/_components/BackupSettings.tsx` | UI（頻率切換 + 立即備份按鈕） |
| `app/actions/backup.ts` | Server Actions：`updateBackupSchedule()` / `runBackupNow()` |
| `supabase/migrations/20260604000000_family_backup_config.sql` | 新表 migration |

### 3.2 改動的檔案

| 檔案 | 改動 |
|------|------|
| `vercel.json` | 加 `{ "path": "/api/cron/backup", "schedule": "0 14 * * 5" }` |
| `app/more/page.tsx` | 多一個入口連結到 `/more/backup` |
| `.env.local` | 新增 `GMAIL_USER`、`GMAIL_APP_PASSWORD`、`BACKUP_TO_EMAIL` |
| `package.json` | 新增依賴：`exceljs`、`nodemailer`、`@types/nodemailer`（dev） |

### 3.3 新表 schema

```sql
CREATE TABLE family_backup_config (
  household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  schedule text NOT NULL DEFAULT 'biweekly' CHECK (schedule IN ('biweekly', 'monthly')),
  biweekly_anchor_date date NOT NULL DEFAULT '2026-06-12',
  last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 預設一筆給目前 household
INSERT INTO family_backup_config (household_id)
SELECT id FROM households
ON CONFLICT (household_id) DO NOTHING;
```

---

## 4. Excel 內容規格

### 4.1 檔名格式

`Family_App_Backup_YYYY-MM-DD.xlsx`（用 Phoenix 時區的日期）

### 4.2 分頁清單

| # | 分頁名 | 對應 Supabase 表 | 預估筆數 |
|---|--------|----------------|---------|
| 1 | 帳戶 | `family_accounts` | ~20 |
| 2 | 交易 | `family_transactions` | ~數千 |
| 3 | 週期交易 | `recurring_transactions` | <50 |
| 4 | 分類 | `family_categories` | ~50 |
| 5 | 商家 | `family_merchants` | ~100 |
| 6 | 商家群組 | `family_merchant_groups` | <30 |
| 7 | 提醒事項 | `maintenance_reminders` | <50 |
| 8 | 匯率快照 | `exchange_rate_snapshots`（過去 1 年） | <400 |

### 4.3 各分頁欄位

每張分頁第 1 列為粗體中文標題（凍結）、底色淺灰、自動寬度。
第 2 列起資料。日期欄用 Excel 日期格式，金額右對齊千分位。
關聯欄位**同時帶 ID 跟可讀名稱**（例：`帳戶ID` + `帳戶名稱`）。

**帳戶分頁欄位**：
`帳戶ID, 名稱, 類別, 幣別, 期初餘額, 開帳日, 備註, 隱藏, 常用`

**交易分頁欄位**：
`交易ID, 日期, 類型, 金額, 幣別, 帳戶ID, 帳戶名稱, 對方帳戶ID, 對方帳戶名稱, 分類ID, 分類名稱, 商家ID, 商家名稱, 擁有者, 備註`

**週期交易分頁欄位**：
`週期ID, 名稱, 類型, 金額, 幣別, 帳戶ID, 帳戶名稱, 分類ID, 分類名稱, 頻率, 起始日, 下次執行日, 已停用`

**分類分頁欄位**：
`分類ID, 名稱, 父分類ID, 父分類名稱, 類型, 顯示順序`

**商家分頁欄位**：
`商家ID, 名稱, 群組ID, 群組名稱, 預設分類ID, 預設分類名稱`

**商家群組分頁欄位**：
`群組ID, 名稱, 顯示順序`

**提醒事項分頁欄位**：
`提醒ID, 標題, 帳戶ID, 帳戶名稱, 到期日, 頻率, 分類, 備註, 已完成`

**匯率快照分頁欄位**：
`日期, 來源幣別, 目標幣別, 匯率`

---

## 5. 排程邏輯

### 5.1 純函式 `shouldSendToday(today, config)`

```
偽碼：
if today.weekday !== 'Friday': return false  // 雙保險
if config.schedule === 'biweekly':
  daysSinceAnchor = (today - config.biweekly_anchor_date) in days
  return daysSinceAnchor >= 0 AND daysSinceAnchor % 14 === 0
if config.schedule === 'monthly':
  return today === firstFridayOfMonth(today.year, today.month)
```

### 5.2 純函式 `nextSendDate(today, config)`

```
偽碼：
if config.schedule === 'biweekly':
  從 anchor 開始往後找第一個 >= today 的「每 14 天」週五
if config.schedule === 'monthly':
  firstFri = firstFridayOfMonth(today.year, today.month)
  return firstFri >= today ? firstFri : firstFridayOfMonth(next_month)
```

### 5.3 切換頻率時的處理

- biweekly → monthly：只改 `schedule` 欄位。`biweekly_anchor_date` 保留（萬一切回去還要用）。
- monthly → biweekly：只改 `schedule` 欄位。anchor 維持 `2026-06-12`，UI 顯示「下次寄送」會自動算。

### 5.4 並發保護

`runBackupNow()` 與 cron 觸發的 `runBackup()` 共用同一段 orchestrator。orchestrator 先檢查 `last_sent_at`：
- 距離現在 < 3 分鐘 → 直接 return `{ skipped: true, reason: 'cooldown' }`
- 否則才實際跑。

---

## 6. 寄信機制

### 6.1 Gmail SMTP 設定

- 主機：`smtp.gmail.com`
- 連接埠：`465`（SSL）
- 帳號：`GMAIL_USER`（環境變數）
- 密碼：`GMAIL_APP_PASSWORD`（環境變數，16 字元 Google App Password）

使用者前置作業（人工，無法由程式代勞）：
1. 開啟 Google 帳號兩階段驗證。
2. 在 Google 帳號「應用程式密碼」介面建立一組密碼，名稱「Family App Backup」，取得 16 字元。
3. 把 3 個環境變數加進 Vercel 三個環境（Production / Preview / Development）—— CLAUDE.md 雷 6。

### 6.2 信件樣板

```
寄件人：Family App <{GMAIL_USER}>
收件人：{BACKUP_TO_EMAIL}
主旨：[Family App] {YYYY-MM-DD} {頻率描述}備份（共 {N} 筆交易）

本文（純文字）：
你好 Oscar，

這是 Family App 的{頻率描述}自動備份。
備份時間：{YYYY-MM-DD HH:mm} (Phoenix)
資料筆數：
  帳戶 {N1}、交易 {N2}、週期 {N3}、分類 {N4}
  商家 {N5}、商家群組 {N6}、提醒 {N7}、匯率快照 {N8}

附件：Family_App_Backup_{YYYY-MM-DD}.xlsx ({size} MB)

—— Family App
```

`{頻率描述}` = 雙週 / 每月 / 手動（手動觸發時用）

---

## 7. 錯誤處理（CLAUDE.md 雷 2）

| 失敗點 | 處置 |
|--------|------|
| Server Component 抓 `family_backup_config` 失敗 | `console.error` + 回傳預設值（biweekly），UI 顯示「設定載入失敗，顯示預設值」 |
| Cron 路由跑備份失敗 | `console.error` + Sentry 上報，回 500 但不 retry（避免重複寄信） |
| 「立即備份」server action 失敗 | 回傳 `{ ok: false, error: '...' }` 給 UI，紅字顯示錯誤 |
| Excel 產生失敗（極端資料量） | fallback 改寄 JSON dump 附件（保命，純資料保險不可失敗） |
| Gmail SMTP 連線失敗 | 重試 1 次（5 秒後），仍失敗就放棄並 log |

---

## 8. 環境變數

| 變數名 | 範例值 | 設定位置 |
|--------|--------|---------|
| `GMAIL_USER` | `ok.oscar.kuo@gmail.com` | `.env.local` + Vercel × 3 環境 |
| `GMAIL_APP_PASSWORD` | 16 字元 App Password | `.env.local` + Vercel × 3 環境 |
| `BACKUP_TO_EMAIL` | `ok.oscar.kuo@gmail.com` | `.env.local` + Vercel × 3 環境 |
| `CRON_SECRET` | 既有 | 既有 |

---

## 9. 部署檢查清單

部署前（本機）：
- [ ] `npm install exceljs nodemailer @types/nodemailer`
- [ ] migration apply：`family_backup_config` 建出來
- [ ] `.env.local` 三個變數設好
- [ ] `npm run check` 通過

部署前（Vercel）：
- [ ] Vercel Production / Preview / Development 各設 3 個環境變數
- [ ] CRON_SECRET 已存在（既有）

部署後驗證：
- [ ] 開 `/more/backup` 頁面正確顯示
- [ ] 按「立即備份」，3 秒內收到 Gmail
- [ ] Excel 8 個分頁資料完整
- [ ] 切換頻率後「下次寄送日」重算正確
- [ ] 等 `2026-06-12`（週五）看 cron 是否自動觸發

---

## 10. 範圍以外（明確不做）

- 不做還原（restore）功能。
- 不做差異備份、加密、壓縮（純 Excel 附件）。
- 不做多收件人。
- 不做備份失敗時的 fallback 通知（除了 Sentry）。
- 不做歷史備份檔在 app 內可下載（純寄信箱）。
- 不做使用者選分頁範圍（每次都是完整 8 個分頁）。

---

## 11. 未來可能延伸（不在此次範圍）

- 自訂寄送時間（不一定週五）
- 自訂收件人
- 加密附件
- 把備份檔同時存到 Google Drive
- 還原功能（從 Excel 重建 DB）
