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

### 🔴 雷 6：Vercel preview 環境變數要單獨設，不能從 production 複製

**症狀**：preview 部署上線後出現「A server error occurred」，logs 顯示 `Error: Invalid supabaseUrl`。

**原因**：Production 的環境變數預設**不會**自動同步到 Preview。新建分支的 preview 部署沒有 Supabase URL/Key，導致連線失敗。

**正確做法**：
- 從 `.env.local` 拿明文值（不是從 Vercel API GET，那拿到的是加密字串）
- 用 `vercel env add KEY preview --value "明文" --yes` 或 API POST 設定
- 三個必設：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- 設完要 `vercel redeploy <preview-url>` 重新 build（因為 `NEXT_PUBLIC_*` 會被烤進 build artifact）

---

### 🔴 雷 7：Vercel API 的 GET env 回傳的是加密字串

**症狀**：用 Vercel API GET `/v10/projects/{id}/env?decrypt=true` 拿到的 value 看起來像 `eyJ2IjoidjIiLCJjIjoi...`，直接用來 POST 到新 environment 會壞掉。

**原因**：那個字串是 Vercel 內部加密 wrapper，CLI token 沒有 decrypt 權限，`decrypt=true` 參數對個人 token 無效。

**正確做法**：
- 從 `.env.local` 讀明文（或用 `vercel env pull .env.production --environment=production`，但 sensitive 變數會是空字串）
- 不要直接從 API GET 結果複製 value 到 POST

---

### 🔴 雷 8：production 跟 main 不同步，從 main 部會「倒退」

**症狀**：把一個小 fix push 到 main，Vercel 自動 deploy 完後，production 上**很多功能消失**（例如新版鍵盤、週期 chip 等）。使用者問「為什麼之前的功能不見了」。

**原因**：使用者習慣從本地 feature 分支用 `npx vercel deploy --prod` 直接推 production。所以 production 一直跑的是 feat 分支的程式碼，**main 落後 20+ 個 commits**。一旦有人 push main 並讓 Vercel 自動 build main，production alias 會被改指向 main 的 build，導致 feat 才有的功能全消失。

**正確做法（AI 部署前必做的檢查）**：
1. 部署前先跑 `git log main..HEAD --oneline` 看當前分支領先 main 幾個 commits
2. 如果領先 > 0，提醒使用者：「main 路線會讓那些 commits 暫時從 production 消失」
3. 預設用 `npx vercel deploy --prod`（從當前分支部），**不要**直接 push main 期待 Vercel 自動部 production，除非當前分支 = main 或當前分支已經 merge 進 main
4. 長期解法：定期把 feat 分支 merge 回 main，讓兩邊收斂

**事件記錄**：2026-05-31 修「連點兩下重複記帳」bug 時踩到。後來重新從 feat 分支 `vercel --prod` 恢復。

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

### 部署前必跑（一個指令搞定）

```bash
npm run check       # = lint + tsc --noEmit + build 一次全跑
```

或單獨跑：
```bash
npm run lint        # ESLint
npx tsc --noEmit    # 型別檢查
npm run build       # 確認能打包
npm run test:e2e:prod  # 跑 e2e 對 production
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

### P0（已完成）
- [x] 把目前未 commit 的 161 個變更分批整理成有意義的 commits（2026-05-25）
- [x] 啟用 Vercel Preview Deployments（已連結 GitHub）
- [x] CLAUDE.md 教訓累積簿
- [x] GitHub Actions CI（lint + tsc + build + e2e）

### P1（剩餘）
- [x] 寫 13 個 Playwright e2e 煙霧測試
- [x] 接 Sentry 錯誤監控（已啟用，confirmed working 2026-05-25）
- [x] Supabase migration 自動 apply 工作流程（待使用者設 GitHub Secrets 啟用，見 docs/github-secrets-setup.md）
- [ ] 建立分支工作流程習慣（之後改東西先 `git checkout -b feat/xxx`，不要直接改 main）
- [ ] 補上需要登入才能測的 e2e（新增交易、隱藏帳戶切換等）

### P2（一個月內）
- [ ] 環境分層：本地 / Preview / Production 各自獨立的 Supabase
- [ ] 拆分 800 行的 AccountList.tsx
- [ ] 強化 PWA：offline 快取、安裝引導

---

## 八、分支工作流程（新習慣）

從現在起，**新的需求先開分支，不要直接動 main**。

### 開始一個新需求

```bash
git checkout main
git pull
git checkout -b feat/簡短描述   # 例：feat/edit-transaction
```

### 改完後

```bash
npm run check               # 跑檢查
git add -A
git commit -m "..."
git push -u origin feat/簡短描述
```

push 後 Vercel 自動產生 preview 網址（見 GitHub PR 留言或 Vercel dashboard）。

### 合併到 main

確認 preview 沒問題後，到 GitHub 開 PR → CI 通過 → merge。
Merge 後 Vercel 自動 deploy 到 production。

### 簡寫指令

| 動作 | 指令 |
|---|---|
| 開新分支 | `git checkout -b feat/xxx` |
| 確認改動 | `npm run check` |
| 推到 GitHub | `git push -u origin HEAD` |
| 跑 e2e | `npm run test:e2e:prod` |

### Preview 網址三種形式

| 網址型態 | 例子 | 變不變 | 用途 |
|---|---|---|---|
| 每次部署的隨機 hash | `family-abc12345-okoscarkuo-netizens-projects.vercel.app` | 每次變 | debug 歷史快照 |
| **每個分支固定的 alias** ⭐ | `family-app-git-<branch>-okoscarkuo-netizens-projects.vercel.app` | 整個分支不變 | **給使用者書籤的網址** |
| Production alias | `family-app-ruddy-one.vercel.app` | 永遠不變 | 家人在用的正式網站 |

要拿分支固定 alias：`npx vercel inspect <任一 preview URL>` 看 Aliases 區塊。

### 啟用 preview 公開存取（一次性設定）

預設 Vercel preview 會要求 SSO 登入。對個人專案建議關掉：

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('/Users/hankuo/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
curl -X PATCH "https://api.vercel.com/v9/projects/prj_dN1SdbhOE39SoB6vhVCjo9aWm15h?teamId=team_1AvjfQlWZkhnWygAfCPgkVFp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection": null}'
```

已於 2026-05-25 設定為 null（公開）。
