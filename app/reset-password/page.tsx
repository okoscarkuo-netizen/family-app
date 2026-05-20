'use client'

import { createClient } from '@/lib/supabase/client'
import { inputClass, primaryButtonClass, secondaryButtonClass, shellBackgroundClass, surfaceClass } from '@/components/PageShell'
import { FormEvent, useEffect, useState } from 'react'

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'missing-session' | 'saving' | 'saved' | 'error'>('checking')
  const [message, setMessage] = useState('正在確認重設密碼連結...')

  useEffect(() => {
    async function prepareRecoverySession() {
      const supabase = createClient()
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const errorDescription = hashParams.get('error_description')

      if (errorDescription) {
        setStatus('error')
        setMessage(decodeURIComponent(errorDescription))
        return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          setStatus('error')
          setMessage(error.message)
          return
        }

        window.history.replaceState(null, '', '/reset-password')
      }

      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        setStatus('missing-session')
        setMessage('這個重設密碼連結沒有帶到有效登入狀態。請回登入頁重新寄一封 Reset Password 信。')
        return
      }

      setStatus('ready')
      setMessage('請輸入新的登入密碼。')
    }

    void prepareRecoverySession()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    const confirmPassword = String(form.get('confirmPassword') || '')

    if (!password || password !== confirmPassword) {
      setStatus('error')
      setMessage('請確認兩次輸入的密碼相同。')
      return
    }

    setStatus('saving')
    setMessage('正在更新密碼...')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('saved')
    setMessage('密碼已更新，正在進入家庭中控。')
    window.location.href = '/'
  }

  const canSubmit = ['ready', 'error'].includes(status)
  const isSaving = status === 'saving'

  return (
    <main className={shellBackgroundClass}>
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10 sm:px-6">
        <div className="w-full space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-[20px] border-2 border-slate-950 bg-[#00c2ff] text-2xl font-black text-slate-950 shadow-[8px_8px_0_#ff3d9a]">
              家
            </div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              家庭中控
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">設定新密碼</h1>
            <p className="mt-2 text-sm font-bold text-slate-600">{message}</p>
          </div>

          <form className={`${surfaceClass} space-y-4`} onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-800">新密碼</label>
            <input
              autoComplete="new-password"
              className={inputClass}
              disabled={!canSubmit}
              minLength={6}
              name="password"
              placeholder="至少 6 碼"
              required
              type="password"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-800">確認新密碼</label>
            <input
              autoComplete="new-password"
              className={inputClass}
              disabled={!canSubmit}
              minLength={6}
              name="confirmPassword"
              placeholder="再輸入一次"
              required
              type="password"
            />
          </div>

          {(status === 'error' || status === 'missing-session') && (
            <div className="rounded-lg border-2 border-slate-950 bg-[#fff45f] px-4 py-3 text-sm font-bold text-slate-950">
              {message}
            </div>
          )}

          <button
            className={`${primaryButtonClass} mt-2 w-full disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white`}
            disabled={!canSubmit || isSaving}
            type="submit"
          >
            {isSaving ? '更新中...' : '更新密碼並登入'}
          </button>
        </form>

        <a className={`${secondaryButtonClass} mt-1 w-full`} href="/login">
          回登入頁
        </a>
      </div>
      </div>
    </main>
  )
}
