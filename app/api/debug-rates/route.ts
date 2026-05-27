import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const ok = res.ok
    const data = ok ? await res.json() as Record<string, unknown> : null
    return NextResponse.json({
      status: res.status,
      ok,
      result: data?.result,
      twd: (data?.rates as Record<string, number> | undefined)?.TWD,
      jpy: (data?.rates as Record<string, number> | undefined)?.JPY,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
