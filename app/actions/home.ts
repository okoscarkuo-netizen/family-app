'use server'

import { revalidatePath } from 'next/cache'

export async function syncHomeData() {
  revalidatePath('/')
  revalidatePath('/accounts')
  revalidatePath('/ledger')
  revalidatePath('/reminders')
  revalidatePath('/categories')
}
