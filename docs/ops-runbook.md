# 上線維護與安全 Runbook

更新日期：2026-05-18

## 正式站資訊

- Production URL: `https://family-app-ruddy-one.vercel.app`
- Vercel project: `family-app`
- Vercel team/scope: `okoscarkuo-netizens-projects`
- 目前登入方式：Supabase Email + 密碼

## 健康檢查項目

正式站基礎檢查：

```bash
curl -I https://family-app-ruddy-one.vercel.app/
curl -I https://family-app-ruddy-one.vercel.app/login
curl -I https://family-app-ruddy-one.vercel.app/manifest.webmanifest
```

預期結果：

- `/` 未登入時應回 `307`，並轉到 `/login`
- `/login` 應回 `200`
- `/manifest.webmanifest` 應回 `200`
- 登入後應進入 dashboard，並能看到帳戶、待辦、帳單、保養等主要區塊

## Vercel 環境變數

Production 目前需要：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase public URL，可出現在前端 bundle
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase anon key，可出現在前端 bundle，但仍需搭配 Supabase RLS
- `SUPABASE_SERVICE_ROLE_KEY`：server-only，供管理 API / admin client 使用，不可寫進 repository

檢查環境變數名稱：

```bash
npx vercel env ls production
```

不要把 production secrets 貼進聊天、文件或 Git。若需要臨時拉取 production env，使用完要立即刪除暫存檔。

## Logs 與部署檢查

檢查目前 production deployment：

```bash
npx vercel inspect https://family-lkkb3eb79-okoscarkuo-netizens-projects.vercel.app
```

查詢近期錯誤 logs：

```bash
npx vercel logs --since 1h --level error --json
```

若 logs 查詢沒有輸出錯誤內容，代表該時間範圍內沒有查到 error-level runtime log。

## 常見故障處理

網站打不開：

- 先檢查 `curl -I` 是否有回應
- 再跑 `npx vercel inspect`
- 若 deployment 不是 `Ready`，查看 Vercel build logs

無法登入：

- 確認 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 與 `SUPABASE_SERVICE_ROLE_KEY` 存在於 Vercel Production
- 確認 `/login` 回 `200`
- 若剛改過 Supabase Auth 設定，需要重新部署或確認 production deployment 已套用最新 env

PWA 異常：

- 確認 `/manifest.webmanifest` 回 `200`
- 若手機上仍顯示舊版本，先關閉 PWA 後重開，必要時移除主畫面捷徑後重新安裝

## 安全注意事項

- `.env.local` 不可被 Git 追蹤
- `.env*` 應維持在 `.gitignore`
- 真實 Supabase 金鑰只放 Vercel env
- Supabase 若開始存正式家庭資料，必須確認 RLS 與備份策略
- 若後續改動 auth flow，先確認 middleware / callback / login page 一起更新
