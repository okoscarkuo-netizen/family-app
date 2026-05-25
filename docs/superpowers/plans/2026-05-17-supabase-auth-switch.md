# Supabase Auth Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single passcode login with Supabase email/password auth supporting two user accounts (user + wife), keeping all existing admin-client DB access unchanged.

**Architecture:** Auth layer switches from passcode cookie to Supabase session cookie. All DB reads/writes continue to use `createAdminClient()` (service role key) — no RLS changes needed. The Supabase session merely proves the user is authenticated; it does not gate individual rows.

**Tech Stack:** Next.js 15 App Router, @supabase/ssr, Supabase Auth (email/password)

---

## Prerequisite: User Must Do in Supabase Dashboard

Before any code changes, complete these steps at https://supabase.com → your project:

1. **Authentication → Providers → Email** → confirm "Enable Email Provider" is ON
2. **Authentication → Users → Add user** → create account for ok.oscar.kuo@gmail.com with a password
3. **Authentication → Users → Add user** → create account for wife's email with a password
4. **Authentication → URL Configuration** → add `https://family-app-ruddy-one.vercel.app` to "Redirect URLs" (for email confirmation links)
5. Confirm both users appear in the Users list

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/login/page.tsx` | Modify | Add email field, change labels |
| `app/actions/auth.ts` | Modify | Use supabase.auth.signInWithPassword + signOut |
| `middleware.ts` | Create (new) | Supabase session verification + redirect logic |
| `proxy.ts` | Delete (after middleware.ts created) | Replaced by middleware.ts |
| `lib/auth/access.ts` | Delete (after proxy.ts removed) | No longer needed |
| `app/api/accounts/route.ts` | Modify | Replace requestHasPrivateAccess with session check |

---

## Task 1: Update Login Page

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace login page content**

Replace entire `app/login/page.tsx` with:

```tsx
import { login } from '@/app/actions/auth'

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  const errorMessage =
    error === 'invalid_credentials' ? '帳號或密碼不正確，請再試一次。' :
    error === 'auth_callback_failed' ? '驗證失敗，請重新登入。' :
    null

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fff45f] px-6 text-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-lg bg-[#ff3d9a] text-2xl font-black text-white shadow-[8px_8px_0_#00c2ff]">
            家
          </div>
          <h1 className="text-3xl font-black text-slate-950">家庭中控</h1>
          <p className="mt-2 text-sm font-bold text-slate-700">輸入帳號密碼進入。</p>
        </div>

        <form action={login} className="space-y-4 rounded-lg border-2 border-slate-950 bg-white p-5 shadow-[10px_10px_0_#25f4a3]">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-800">Email</label>
            <input
              autoComplete="email"
              autoFocus
              className="w-full rounded-lg border-2 border-slate-950 bg-[#e9fbff] px-4 py-3 text-base font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#ff8c42]"
              name="email"
              placeholder="your@email.com"
              required
              type="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-800">密碼</label>
            <input
              autoComplete="current-password"
              className="w-full rounded-lg border-2 border-slate-950 bg-[#e9fbff] px-4 py-3 text-base font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#ff8c42]"
              name="password"
              placeholder="輸入密碼"
              required
              type="password"
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            className="mt-2 w-full rounded-lg bg-[#ff3d9a] py-3 text-base font-black text-white transition-transform hover:-translate-y-0.5 hover:bg-[#e92b87]"
            type="submit"
          >
            進入
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify dev server compiles**

```bash
npm run dev
```
Expected: no compile errors, login page shows email + password fields at http://localhost:3000/login

---

## Task 2: Update Auth Server Actions

**Files:**
- Modify: `app/actions/auth.ts`

- [ ] **Step 1: Replace entire file**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=invalid_credentials')
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Verify dev server compiles**

```bash
npm run dev
```
Expected: no compile errors

---

## Task 3: Create New Middleware

The current auth guard is in `proxy.ts` and exported as a named export. Next.js expects `middleware.ts` at the project root with a default export.

**Files:**
- Create: `middleware.ts` (project root)

- [ ] **Step 1: Create `middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/')

  if (!user && !isLoginPage && !isAuthCallback) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Check if proxy.ts is imported anywhere**

```bash
grep -r "proxy" /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App/app /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App/lib --include="*.ts" --include="*.tsx" -l
```
Expected: no results (proxy.ts is standalone, not imported)

- [ ] **Step 3: Rename proxy.ts to proxy.ts.bak (keep as backup)**

```bash
mv proxy.ts proxy.ts.bak
```

- [ ] **Step 4: Restart dev server and test auth redirect**

```bash
npm run dev
```
Expected: visiting http://localhost:3000 redirects to /login if not logged in

---

## Task 4: Update /api/accounts Auth Check

The `/api/accounts` API route currently uses `requestHasPrivateAccess(request)` (passcode cookie check). Replace with Supabase session check.

**Files:**
- Modify: `app/api/accounts/route.ts`

- [ ] **Step 1: Replace auth check at top of GET and PUT handlers**

In `app/api/accounts/route.ts`, remove the import:
```ts
import { requestHasPrivateAccess } from '@/lib/auth/access'
```

Add this import at the top:
```ts
import { createClient } from '@/lib/supabase/server'
```

Add this helper function after the imports:
```ts
async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user !== null
  } catch {
    return false
  }
}
```

Replace the two auth checks:
```ts
// OLD (remove these lines in GET and PUT):
if (!requestHasPrivateAccess(request)) return unauthorized();

// NEW (replace with in GET and PUT):
if (!await isAuthenticated()) return unauthorized();
```

- [ ] **Step 2: Verify GET and PUT still work in dev**

```bash
npm run dev
```
Go to `/accounts` page → should load accounts correctly

---

## Task 5: End-to-End Test

- [ ] **Step 1: Test login flow**

1. Open http://localhost:3000 → should redirect to /login
2. Enter your email + password (created in Supabase Dashboard)
3. Should redirect to `/` after successful login

- [ ] **Step 2: Test wrong password**

Enter wrong password → should show "帳號或密碼不正確，請再試一次。"

- [ ] **Step 3: Test logout**

Click "登出" → should redirect to /login

- [ ] **Step 4: Test wife's account**

Login with wife's email + password → should work

- [ ] **Step 5: Test accounts still sync**

Go to `/accounts` → should still show all accounts from Supabase

---

## Task 6: Deploy to Production

- [ ] **Step 1: Add env var to Vercel (if not already there)**

Check Vercel Dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` ← must exist
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← must exist
- `SUPABASE_SERVICE_ROLE_KEY` ← must exist

- [ ] **Step 2: Remove old env vars if present**

If `FAMILY_APP_PASSCODE` or `FAMILY_APP_SESSION_SECRET` exist in Vercel env vars, they can be removed after this migration.

- [ ] **Step 3: Commit and push**

```bash
git add middleware.ts app/login/page.tsx app/actions/auth.ts app/api/accounts/route.ts
git commit -m "feat: switch auth to Supabase email/password login"
git push origin main
```

- [ ] **Step 4: Test production login**

Visit https://family-app-ruddy-one.vercel.app → login with Supabase credentials

---

## Cleanup (after confirming production works)

- [ ] Delete `proxy.ts.bak`
- [ ] Delete `lib/auth/access.ts` (no longer imported anywhere)
- [ ] Commit cleanup: `git commit -m "chore: remove passcode auth artifacts"`
