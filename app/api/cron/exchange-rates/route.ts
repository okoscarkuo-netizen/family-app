import { refreshTwdRateTable } from '@/lib/exchange-rates'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

function missingSecret() {
  return NextResponse.json(
    { error: 'missing_cron_secret', message: 'Set CRON_SECRET in your Vercel project.' },
    { status: 500 },
  )
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return missingSecret()

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) return unauthorized()

  return null
}

export async function GET(request: NextRequest) {
  const authResponse = isAuthorized(request)
  if (authResponse) return authResponse

  try {
    const table = await refreshTwdRateTable()

    return NextResponse.json({
      success: true,
      source: table.latest.source,
      latestDate: table.latest.date,
      officialLatestDate: table.officialLatestDate,
      checkedAt: table.checkedAt,
      savedDates: table.dates.length,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to refresh exchange rates.'

    return NextResponse.json(
      {
        success: false,
        error: 'refresh_failed',
        message,
      },
      { status: 503 },
    )
  }
}
