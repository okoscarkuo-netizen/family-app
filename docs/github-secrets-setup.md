# GitHub Actions 需要的 Secrets 設定

我已經幫你加了兩個自動化工作流程：

| 工作流程 | 觸發時機 | 用途 |
|---|---|---|
| `ci.yml` | 每次 PR 與 push 到 main | 自動跑 lint、type 檢查、build、e2e 煙霧測試 |
| `supabase-migrations.yml` | push 到 main 且 `supabase/migrations/` 有變更 | 自動把 migration apply 到 production Supabase |

**`ci.yml` 已經可以直接運作**（不需要 secrets）。

**`supabase-migrations.yml` 需要你做下面這 4 步**才會生效。完成前，migration 仍要手動同步（就像今天遇到 `remark` 欄位那樣）。

---

## 第一步：拿 Supabase Access Token

1. 打開 https://supabase.com/dashboard/account/tokens
2. 點 **「Generate new token」**
3. 名稱填：`GitHub Actions Auto Migration`
4. 點 Generate
5. **複製產生的 token**（只會顯示一次，存到記事本）

---

## 第二步：拿 Project Ref 與 DB Password

1. 打開 https://supabase.com/dashboard/projects
2. 點選你的 `family-app` 專案
3. **Project Ref**：網址列上有一段像 `abcdefghijklmnop` 的字串（在 `/project/` 後面），複製
4. **DB Password**：左側選 Project Settings → Database → 找到 `Database Password`
   - 如果你記得密碼，直接打
   - 不記得就點「Reset database password」重設一個（重設後本機 `.env.local` 也要更新）

---

## 第三步：在 GitHub 加 Secrets

1. 打開 https://github.com/okoscarkuo-netizen/family-app/settings/secrets/actions
2. 點「New repository secret」**三次**，依序加：

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | 第一步那個 token |
| `SUPABASE_PROJECT_ID` | 第二步的 Project Ref |
| `SUPABASE_DB_PASSWORD` | 第二步的 DB password |

---

## 第四步：測試

下次有人改 `supabase/migrations/` 底下任何檔案 push 到 main，GitHub Actions 會自動跑 `supabase db push`。

可以在 https://github.com/okoscarkuo-netizen/family-app/actions 看執行紀錄。

---

## 如果不想設定

完全可以跳過。**現有的 App 不會壞**，只是每次新增 migration 後，要手動到 Supabase 跑 SQL（或本機 `supabase db push`）。

CI 工作流程（`ci.yml`）跟這個無關，會繼續正常運作。
