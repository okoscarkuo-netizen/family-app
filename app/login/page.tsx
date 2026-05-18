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
