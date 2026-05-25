import { login } from '@/app/actions/auth'
import { PasskeySignInButton } from './_components/PasskeySignInButton'
import { inputClass, primaryButtonClass, shellBackgroundClass, surfaceClass } from '@/components/PageShell'

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
    <main className={shellBackgroundClass}>
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10 sm:px-6">
        <div className="w-full space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-[20px] border-2 border-slate-950 bg-[#ff3d9a] text-2xl font-black text-white shadow-[8px_8px_0_#00c2ff]">
              家
            </div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              家庭中控
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">登入家庭空間</h1>
            <p className="mt-2 text-sm font-bold text-slate-600">輸入 Email 與密碼進入。</p>
          </div>

          <form action={login} className={`${surfaceClass} space-y-4`}>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-800">Email</label>
            <input
              autoComplete="email"
              autoFocus
              className={inputClass}
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
              className={inputClass}
              name="password"
              placeholder="輸入密碼"
              required
              type="password"
            />
          </div>

          {errorMessage && (
            <div className="rounded-md border-2 border-slate-950 bg-[#fff45f] px-4 py-3 text-sm font-bold text-slate-950">
              {errorMessage}
            </div>
          )}

          <button
            className={`${primaryButtonClass} mt-2 w-full`}
            type="submit"
          >
            進入
          </button>
          <PasskeySignInButton />
          <p className="text-center text-xs font-bold text-slate-500">
            <a href="/reset-password" className="underline hover:text-slate-800">忘記密碼？</a>
          </p>
        </form>
        </div>
      </div>
    </main>
  )
}
