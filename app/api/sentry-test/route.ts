// Temporary endpoint to verify Sentry integration.
// Visit /api/sentry-test once to confirm errors land in Sentry, then this file can be deleted.

export const dynamic = 'force-dynamic'

export async function GET() {
  throw new Error('Sentry 煙霧測試 — 如果你在 Sentry dashboard 看到這則訊息代表整合成功')
}
