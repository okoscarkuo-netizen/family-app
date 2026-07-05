export const DATA_CACHE_TAGS = {
  accounts: 'family-accounts',
  categories: 'family-categories',
  merchants: 'family-merchants',
  merchantGroups: 'family-merchant-groups',
  reminders: 'family-reminders',
  transactions: 'family-transactions',
  rates: 'family-rates',
} as const

export const DATA_CACHE_REVALIDATE_SECONDS = 60 * 5
export const RATE_CACHE_REVALIDATE_SECONDS = 60 * 60
