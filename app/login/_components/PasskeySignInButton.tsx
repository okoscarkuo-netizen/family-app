'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPasskeysEnabled } from '@/lib/supabase/passkey-settings'

function supportsPasskey() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined' && window.isSecureContext
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (message.includes('mfa_webauthn_verify_not_enabled')) {
    return '這個家庭帳號尚未啟用 Passkey，請先到 Supabase Auth 設定打開。'
  }
  if (message.includes('Browser does not support WebAuthn')) return '這台裝置或瀏覽器目前不支援 Passkey。'
  if (message.includes('not allowed') || message.includes('AbortError')) return '你已取消 Passkey 驗證。'
  if (message.includes('security key') || message.includes('passkey')) return 'Passkey 驗證失敗，請再試一次。'
  return '目前無法使用 Passkey 登入。'
}

export function PasskeySignInButton() {
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPasskeysEnabled, setIsPasskeysEnabled] = useState<boolean | null>(null)
  const isBusy = isSigningIn || isRedirecting
  const canUsePasskey = useSyncExternalStore(
    () => () => {},
    supportsPasskey,
    () => false,
  )

  useEffect(() => {
    void getPasskeysEnabled().then(setIsPasskeysEnabled)
  }, [])

  async function handleSignIn() {
    setError(null)
    setIsSigningIn(true)

    try {
      if (isPasskeysEnabled === false) {
        throw new Error('mfa_webauthn_verify_not_enabled')
      }

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPasskey()
      if (error) throw error
      setIsRedirecting(true)
      window.location.assign('/')
    } catch (error) {
      setError(errorMessage(error))
      setIsSigningIn(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={isBusy || !canUsePasskey || isPasskeysEnabled === false}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-[#d8e3df] bg-[#f7faf8] px-4 py-3 text-sm font-semibold text-[#27594e] shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#178369] shadow-[inset_0_0_0_1px_#d8efe7]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M12 3v4" />
            <path d="M6 8v3a6 6 0 0 0 12 0V8" />
            <path d="M9 21h6" />
            <path d="M10 17h4" />
          </svg>
        </span>
        <span>{isRedirecting ? '登入成功，進入首頁…' : isSigningIn ? 'Passkey 驗證中…' : '使用 Passkey 登入'}</span>
      </button>

      {!canUsePasskey ? (
        <p className="text-center text-xs font-bold text-slate-400">
          Passkey 需要支援 WebAuthn 的瀏覽器，並且在 HTTPS 或 localhost 下使用。
        </p>
      ) : isPasskeysEnabled === false ? (
        <p className="text-center text-xs font-bold text-rose-500">
          這個家庭帳號目前尚未啟用 Passkey，請先在 Supabase Auth 設定打開。
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-[#f2b4a8] bg-[#fff4f1] px-3 py-2 text-sm font-bold text-[#c1543e]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
