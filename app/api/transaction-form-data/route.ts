import { NextResponse } from 'next/server'
import { getAllMerchants, getMerchantGroups } from '@/lib/family-transactions'
import { getTwdRateTable } from '@/lib/exchange-rates'
import { getMaintenanceItemsForForm } from '@/lib/reminders-db'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Section = 'merchants' | 'maintenance' | 'rates'

const VALID_SECTIONS = new Set<Section>(['merchants', 'maintenance', 'rates'])

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const searchParams = new URL(request.url).searchParams
    const sections = (searchParams.get('sections') ?? '')
      .split(',')
      .map((section) => section.trim())
      .filter((section): section is Section => VALID_SECTIONS.has(section as Section))

    if (sections.length === 0) {
      return NextResponse.json({})
    }

    const wantsMerchants = sections.includes('merchants')
    const wantsMaintenance = sections.includes('maintenance')
    const wantsRates = sections.includes('rates')

    const [merchants, merchantGroups, maintenanceItems, rateTable] = await Promise.all([
      wantsMerchants ? getAllMerchants() : Promise.resolve(undefined),
      wantsMerchants ? getMerchantGroups() : Promise.resolve(undefined),
      wantsMaintenance ? getMaintenanceItemsForForm() : Promise.resolve(undefined),
      wantsRates ? getTwdRateTable() : Promise.resolve(undefined),
    ])

    return NextResponse.json({
      ...(wantsMerchants ? { merchants, merchantGroups } : {}),
      ...(wantsMaintenance ? { maintenanceItems } : {}),
      ...(wantsRates ? { rateTable } : {}),
    })
  } catch (error) {
    console.error('[transaction-form-data] GET failed:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
