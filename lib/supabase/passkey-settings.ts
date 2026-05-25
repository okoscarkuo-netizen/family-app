type AuthSettingsResponse = {
  passkeys_enabled?: boolean
}

let cachedPasskeysEnabled: boolean | null | undefined
let inFlightRequest: Promise<boolean | null> | null = null

export async function getPasskeysEnabled() {
  if (typeof cachedPasskeysEnabled !== 'undefined') return cachedPasskeysEnabled
  if (inFlightRequest) return inFlightRequest

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    cachedPasskeysEnabled = null
    return cachedPasskeysEnabled
  }

  inFlightRequest = fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) return null

      const data = (await response.json()) as AuthSettingsResponse
      return typeof data.passkeys_enabled === 'boolean' ? data.passkeys_enabled : null
    })
    .catch(() => null)
    .finally(() => {
      inFlightRequest = null
    })

  cachedPasskeysEnabled = await inFlightRequest
  return cachedPasskeysEnabled
}
