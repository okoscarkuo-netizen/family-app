# Sentry 錯誤監控啟用步驟

Sentry 程式碼已經接好了，但**現在還是關閉狀態**，因為沒設定 DSN 環境變數。

只要做完下面 4 步，正式網站出錯時就會自動推訊息給你。

---

## 步驟一：免費註冊 Sentry

1. 去 https://sentry.io/signup/
2. 用 GitHub 或 Email 註冊（免費版額度足夠個人使用）
3. 選擇「Create a new project」
4. 平台選 **Next.js**
5. 專案名稱：`family-app`

註冊完會看到一串 DSN，長這樣：
```
https://abc123xyz@o4500000.ingest.sentry.io/4500000
```
**複製起來**。

---

## 步驟二：在 Vercel 設定環境變數

1. 打開 https://vercel.com/okoscarkuo-netizens-projects/family-app/settings/environment-variables
2. 加三個變數（**三個環境都要勾**：Production / Preview / Development）：

| 變數名 | 值 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | （步驟一的 DSN） | 前端與後端錯誤上傳 |
| `SENTRY_ORG` | （Sentry 左上角的 org slug） | source map 上傳 |
| `SENTRY_PROJECT` | `family-app` | 對應的專案 |

3. **另外建一個 SENTRY_AUTH_TOKEN**（用於 source map 上傳）：
   - 在 Sentry：Settings → Auth Tokens → Create New Token
   - Scope 勾 `project:releases` 和 `project:write`
   - 複製 token，貼到 Vercel 的 `SENTRY_AUTH_TOKEN` 環境變數

---

## 步驟三：本地測試

在 `.env.local` 加：
```
NEXT_PUBLIC_SENTRY_DSN=https://你的DSN
SENTRY_ORG=你的org
SENTRY_PROJECT=family-app
SENTRY_AUTH_TOKEN=你的token
```

然後 `npm run build`，沒報錯就 OK。

---

## 步驟四：觸發一次測試錯誤

在 production 部署一個會丟錯的測試，例如某頁加：
```ts
throw new Error('Sentry 測試')
```

打開那一頁，30 秒內 Sentry dashboard 就會收到事件 → 設定通知方式（Slack / Email / Discord）。

---

## 之後怎麼用

正常開發不需要做任何事。Sentry 會自動：
- 抓 server-side error
- 抓 client-side JS error
- 抓 Server Action 失敗
- 附帶 source map（看得到原始 TypeScript 行號）
- 標記 environment（preview vs production）

出錯就會收通知，不用再來問 AI「production 為什麼壞了」。

---

## 不想用怎麼辦

把 `NEXT_PUBLIC_SENTRY_DSN` 環境變數移除即可。程式碼會自動回到原始行為（不丟錯到 Sentry），完全不影響 App。
