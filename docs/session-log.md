# Session Log — 多 AI session 協作日誌

> **這個檔案是「公告欄」。**每個 session（Claude、Codex、Antigravity 等）開工前**必讀**，看別人在動什麼；開工時在**最上面**追加一行宣告自己要做什麼。
>
> 格式：`日期 時間  工具  分支  做什麼  → 狀態`
>
> 狀態：`進行中` / `完成` / `暫停`

---

## 規則速查（細節見 `core_rules.md` 三點五節）

1. **開工前**：跑 `git status --short` 看有沒有別人沒 commit 的工作；讀這個檔最新幾行；發現別人在動同一個檔 → **停下來問使用者**。
2. **動工時**：在最上面（下面這條表格的最上方）加一行宣告。
3. **離開前**：把對應行的狀態改成 `完成` 或 `暫停`。
4. **看到別人 uncommitted 改動**：不 stash、不 reset、不 commit 別人的。改自己負責的檔案、避開衝突。

---

## 工作紀錄（最新在最上面）

| 日期 時間 | 工具 | 分支 | 做什麼 | 狀態 |
|---|---|---|---|---|
| 2026-06-01 11:05 | Claude | main ← feat/app-smoothness | 合併 feat/app-smoothness 進 main 並推上去（讓 Vercel 自動部 production，修復商家選擇器舊版顯示）。merge commit 03012d9 已 push 到 origin/main，等 Vercel 自動 build | 完成 |
| 2026-06-01 11:30 | Claude | feat/app-smoothness | 建立 session log + 加入多 session 協作規則進 core_rules.md | 完成 |
