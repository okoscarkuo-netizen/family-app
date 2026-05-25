'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPasskeysEnabled } from '@/lib/supabase/passkey-settings'

type PasskeyItem = {
  id: string
  friendly_name?: string
  created_at: string
  last_used_at?: string
}

function supportsPasskey() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined' && window.isSecureContext
}

function formatDateTime(value?: string) {
  if (!value) return '未紀錄'

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function passkeyName(passkey: PasskeyItem) {
  return passkey.friendly_name?.trim() || '未命名 Passkey'
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (message.includes('session_not_found') || message.includes('Auth session missing')) return '請先登入，再註冊這台裝置的 Passkey。'
  if (message.includes('mfa_webauthn_enroll_not_enabled')) {
    return '這個家庭帳號尚未啟用 Passkey，請先到 Supabase Auth 設定打開。'
  }
  if (message.includes('Browser does not support WebAuthn')) return '這台裝置或瀏覽器目前不支援 Passkey。'
  if (message.includes('not allowed') || message.includes('AbortError')) return '你已取消 Passkey 註冊。'
  if (message.includes('already') || message.includes('duplicate')) return '這台裝置可能已註冊過 Passkey。'
  return '目前無法註冊 Passkey，請稍後再試。'
}

export function PasskeyRegistrationCard() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [draftNames, setDraftNames] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [busyPasskeyId, setBusyPasskeyId] = useState<string | null>(null)
  const [isPasskeysEnabled, setIsPasskeysEnabled] = useState<boolean | null>(null)
  const canUsePasskey = useSyncExternalStore(
    () => () => {},
    supportsPasskey,
    () => false,
  )

  useEffect(() => {
    void getPasskeysEnabled().then(setIsPasskeysEnabled)
  }, [])

  useEffect(() => {
    let active = true

    async function loadPasskeys() {
      setIsLoading(true)

      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.passkey.list()
        if (error) throw error
        if (!active) return

        const items = data ?? []
        setPasskeys(items)
        setDraftNames((current) => {
          const next: Record<string, string> = {}

          for (const passkey of items) {
            next[passkey.id] = current[passkey.id] ?? passkey.friendly_name ?? ''
          }

          return next
        })
      } catch (error) {
        if (!active) return
        setIsError(true)
        setMessage(errorMessage(error))
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadPasskeys()

    return () => {
      active = false
    }
  }, [])

  async function refreshPasskeys() {
    const supabase = createClient()
    const { data, error } = await supabase.auth.passkey.list()
    if (error) throw error

    const items = data ?? []
    setPasskeys(items)
    setDraftNames((current) => {
      const next: Record<string, string> = {}

      for (const passkey of items) {
        next[passkey.id] = current[passkey.id] ?? passkey.friendly_name ?? ''
      }

      return next
    })
  }

  async function handleRegister() {
    setMessage(null)
    setIsError(false)
    setIsRegistering(true)

    try {
      if (isPasskeysEnabled === false) {
        throw new Error('mfa_webauthn_enroll_not_enabled')
      }

      const supabase = createClient()
      const { error } = await supabase.auth.registerPasskey()
      if (error) throw error
      await refreshPasskeys()
      setMessage('這台裝置的 Passkey 已註冊完成。')
    } catch (error) {
      setIsError(true)
      setMessage(errorMessage(error))
    } finally {
      setIsRegistering(false)
    }
  }

  async function handleRename(passkeyId: string) {
    const friendlyName = (draftNames[passkeyId] ?? '').trim()

    if (!friendlyName) {
      setIsError(true)
      setMessage('請先輸入 Passkey 名稱。')
      return
    }

    setMessage(null)
    setIsError(false)
    setBusyPasskeyId(passkeyId)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName })
      if (error) throw error

      setPasskeys((current) =>
        current.map((passkey) =>
          passkey.id === passkeyId ? { ...passkey, friendly_name: friendlyName } : passkey
        )
      )
      setMessage('Passkey 名稱已更新。')
    } catch (error) {
      setIsError(true)
      setMessage(errorMessage(error))
    } finally {
      setBusyPasskeyId(null)
    }
  }

  async function handleDelete(passkeyId: string) {
    if (typeof window !== 'undefined' && !window.confirm('確定要刪除這個 Passkey 嗎？')) return

    setMessage(null)
    setIsError(false)
    setBusyPasskeyId(passkeyId)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.passkey.delete({ passkeyId })
      if (error) throw error

      setPasskeys((current) => current.filter((passkey) => passkey.id !== passkeyId))
      setDraftNames((current) => {
        const next = { ...current }
        delete next[passkeyId]
        return next
      })
      setMessage('Passkey 已刪除。')
    } catch (error) {
      setIsError(true)
      setMessage(errorMessage(error))
    } finally {
      setBusyPasskeyId(null)
    }
  }

  return (
    <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">Passkey</p>
      <h2 className="mt-2 text-[1.05rem] font-black text-slate-950">管理這個家庭帳號的 Passkey</h2>
      <p className="mt-1 text-sm font-bold text-slate-600">
        註冊後可以直接用裝置驗證登入，也能在這裡改名或刪除既有 Passkey。
      </p>

      <button
        type="button"
        onClick={() => void handleRegister()}
        disabled={isRegistering || !canUsePasskey || isPasskeysEnabled === false}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-[#d8e3df] bg-[#f7faf8] px-4 py-3 text-sm font-semibold text-[#27594e] shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#178369] shadow-[inset_0_0_0_1px_#d8efe7]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 ${isRegistering ? 'animate-spin' : ''}`}
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
        <span>{isRegistering ? '註冊中…' : '註冊這台裝置'}</span>
      </button>

      {!canUsePasskey ? (
        <p className="mt-2 text-xs font-bold text-slate-400">
          Passkey 需要支援 WebAuthn 的瀏覽器，並且在 HTTPS 或 localhost 下使用。
        </p>
      ) : isPasskeysEnabled === false ? (
        <p className="mt-2 text-xs font-bold text-rose-500">
          這個家庭帳號目前尚未啟用 Passkey，請先在 Supabase Auth 設定打開。
        </p>
      ) : null}

      <div className="mt-4 rounded-[1rem] border border-[#f1ede6] bg-[#fbfaf7] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">已註冊清單</p>
          <span className="rounded-full border border-[#e7ded1] bg-white px-2.5 py-1 text-[0.72rem] font-black text-slate-500">
            {passkeys.length} 個
          </span>
        </div>

        {isLoading ? (
          <p className="mt-3 text-sm font-bold text-slate-500">載入 Passkey 清單中…</p>
        ) : passkeys.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-slate-500">
            目前還沒有註冊任何 Passkey。先註冊這台裝置，之後登入會更快。
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {passkeys.map((passkey) => {
              const currentName = draftNames[passkey.id] ?? ''
              const isBusy = busyPasskeyId === passkey.id
              const hasChanged = currentName.trim() !== (passkey.friendly_name ?? '').trim()

              return (
                <article key={passkey.id} className="rounded-[1rem] border border-[#ece4d8] bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{passkeyName(passkey)}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        建立時間：{formatDateTime(passkey.created_at)}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        最後使用：{formatDateTime(passkey.last_used_at)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#d8efe7] bg-[#effbf8] px-2.5 py-1 text-[0.68rem] font-black tracking-[0.14em] text-[#178369]">
                      Passkey
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input
                      aria-label="Passkey 名稱"
                      className="w-full rounded-[0.9rem] border border-[#e3ddd3] bg-[#fcfbf9] px-3 py-2 text-sm font-bold text-slate-950 placeholder:text-slate-400 focus:border-[#178369] focus:outline-none"
                      onChange={(event) =>
                        setDraftNames((current) => ({
                          ...current,
                          [passkey.id]: event.target.value,
                        }))
                      }
                      placeholder="輸入友善名稱，例如 iPhone 15"
                      value={currentName}
                    />

                    <button
                      type="button"
                      onClick={() => void handleRename(passkey.id)}
                      disabled={isBusy || !hasChanged}
                      className="inline-flex items-center justify-center rounded-[0.9rem] border border-[#d8e3df] bg-[#f7faf8] px-3 py-2 text-sm font-bold text-[#27594e] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy ? '處理中…' : '改名'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(passkey.id)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center rounded-[0.9rem] border border-[#f2b4a8] bg-[#fff4f1] px-3 py-2 text-sm font-bold text-[#c1543e] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {message ? (
        <p className={`mt-3 rounded-md px-3 py-2 text-sm font-bold ${isError ? 'border border-[#f2b4a8] bg-[#fff4f1] text-[#c1543e]' : 'border border-[#cdeee5] bg-[#effbf8] text-[#178369]'}`}>
          {message}
        </p>
      ) : null}
    </section>
  )
}
