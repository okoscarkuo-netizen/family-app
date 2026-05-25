@AGENTS.md

# CLAUDE.md — 教訓累積簿

> 這個檔案每次 AI 對話開始時都會自動讀。
> 用途：把「學過的痛」與「不要再踩的雷」寫下來，避免下次重犯。
> 規則：每次發現 AI 做錯一件事，就在這裡加一條。只增加、不刪除。

---

## 一、雷區清單（已經踩過的坑）

### 🔴 雷 1：Supabase 新增欄位沒同步到 production

**症狀**：使用者點儲存 → 跳「An error occurred in the Server Components render」→ 改 hidden 也存不進去。

**原因**：本地新增的欄位（例如 `remark`、`opening_balance`、`favorite`）migration 沒 apply 到 production。Supabase 回傳「Could not find the 'X' column」，整個 UPDATE 失敗。

**正確做法**：
- 新欄位一律先用 `probeColumn()` 偵測是否存在
- 不存在就不要把該欄位送進 UPDATE payload
- 參考 `lib/accounts-db.ts` 的 `supportsRemarkColumn()` / `supportsFavoriteColumn()`
- 對應的 action 範例見 `app/actions/accounts.ts` 的 `updateAccount`

---

### 🔴 雷 2：Server Component 直接 throw → 整頁 crash

**症狀**：production 出現「An error occurred in the Server Components render. The specific message is omitted...」這種神祕錯誤。

**原因**：Server Component 裡的 DB function（例如 `getAccountLedgerDelta`）遇到任何錯誤就 `throw new Error(...)`，導致整個頁面 crash。

**正確做法**：
- Server Component 裡的 fetch function 用 try/catch
- 失敗就 `console.error` + 回傳 fallback（0 / 空陣列 / null）
- 不要讓使用者看到 crash 畫面，要看到「資料載入失敗」也比 crash 好
- 參考 `lib/accounts-db.ts` 的 `getAccountLedgerDelta`、`getAccounts`

---

### 🟡 雷 3：金額顯示沒做自動縮字級

**症狀**：當數字很大（例如 1 億以上）會超出卡片框框。

**正確做法**：依數字大小套不同 class，分四級（< 100 萬 / 100 萬-1000 萬 / 1000 萬-1 億 / 1 億以上）。
- 參考 `app/_components/AssetTrendCard.tsx` 的 `netAssetsTextClass` / `deltaTextClass`

---

### 🟡 雷 4：金額沒標幣別容易誤解

**症狀**：使用者問「這個數字是台幣還是美金」。

**正確做法**：只要畫面同時可能有 TWD / USD / JPY，金額後面一定要加幣別小字標籤。
- 範例：`app/accounts/_components/AccountList.tsx` 隱藏帳戶餘額後面的 `TWD` 標籤

---

### 🟡 雷 5：跨幣別直接加總是錯的

**正確做法**：所有跨幣別加總一定要先用 `convertToTwd()` 換算成 TWD 再加。
- 換算來源：`lib/exchange-rates.ts`
- 範例：`app/_components/AssetTrendCard.tsx`

---

## 二、隱藏帳戶機制（重要專案知識）

- 隱藏用 `hidden: true` 欄位，**不是** `is_archived`
- `getAccounts()` 回傳所有 `is_archived = false` 的帳戶（含 hidden）
- 隱藏 vs 顯示由前端 `AccountList` 的 `showHiddenAccounts` state 決定
- 隱藏帳戶餘額在 `AccountOverviewPanel` 只加總 TWD 那些（其他幣別不計入）

---

## 三、工作流程規則（除了 AGENTS.md 之外）

### Commit 紀律

- **完成一個明確小目標就 commit 一次**（例如「修隱藏帳戶 bug」）
- **不要累積 100+ 檔案沒 commit**（之前曾累積到 161 個）
- 每個 commit 訊息要白話、看得懂改了什麼

### 部署前必跑

```bash
npx tsc --noEmit    # 型別檢查
npm run build       # 確認能打包
```

### Production 出錯怎麼查

```bash
npx vercel logs family-app-ruddy-one.vercel.app --limit 50
```
從這個 log 找 500 錯誤、找 error 訊息。**不要靠猜**。

### 部署指令

```bash
npx vercel deploy --prod
```
部署完成後給使用者 production URL 確認。

---

## 四、專案重要事實

| 項目 | 內容 |
|---|---|
| Production URL | https://family-app-ruddy-one.vercel.app |
| Git remote | github.com/okoscarkuo-netizen/family-app |
| 主分支 | `main` |
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript |
| 樣式 | Tailwind CSS v4 |
| 資料庫 | Supabase（PostgreSQL）|
| 部署 | Vercel |
| 測試 | 目前沒有（之後要加 Playwright e2e）|
| 預覽環境 | 目前沒有（之後要啟用 Vercel Preview）|

### 使用者環境
- 人在亞利桑那（America/Phoenix），但記帳主要用台幣
- 老婆 = Livia、老公 = Oscar
- 有「共用」帳戶（夫妻共用，例如房貸、家庭支出）

---

## 五、使用者偏好（重要！）

- **語言**：繁體中文，白話文，**絕對不要用技術術語不解釋**
- **回覆**：短、重點先說、結論優先；不要長篇大論
- **執行紀律**：
  - 小型、明確、可還原 → 直接做
  - 刪檔、改 DB 結構、部署 → **先問**
  - 大型重構、多個目標衝突 → **先列方案讓使用者選**
- **不要做的事**：
  - 不要主動加沒被要求的功能
  - 不要主動做沒被要求的「順手優化」
  - 不要假裝使用者懂程式（他不會寫程式，全靠口述）
  - 不要把錯誤訊息直接貼給使用者，要先解讀

---

## 六、規則維護機制

- 每次踩到新雷 → 在「雷區清單」加一條（標號往下）
- 每次學到新的使用者偏好 → 加在「使用者偏好」
- 每次發現新的專案事實 → 加在「專案重要事實」
- 規則只增加、不刪除（除非被證明錯誤）

---

## 七、待辦改善清單（依優先順序）

> AI 看到使用者提到下面這些主題時，主動引導他做。

### P0（最近要做）
- [ ] 把目前未 commit 的 161 個變更分批整理成有意義的 commits
- [ ] 啟用 Vercel Preview Deployments（每個分支自動產生預覽網址）
- [ ] 建立分支工作流程（不要直接改 main）

### P1（兩週內）
- [ ] 寫 5-10 個 Playwright e2e 測試（登入、新增交易、首頁載入、隱藏帳戶）
- [ ] 接 Sentry 錯誤監控（免費版）
- [ ] Supabase migration 自動 apply 到 production

### P2（一個月內）
- [ ] 環境分層：本地 / Preview / Production 各自獨立的 Supabase
- [ ] 拆分 800 行的 AccountList.tsx
- [ ] 強化 PWA：offline 快取、安裝引導
