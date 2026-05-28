import type { FamilyCategory } from '@/lib/family-transactions'

export const CATEGORY_ICON_CHOICES = [
  '•',
  '◦',
  '◼',
  '◻',
  '◾',
  '◽',
  '●',
  '○',
  '◆',
  '◇',
  '▲',
  '△',
  '▼',
  '▽',
  '■',
  '□',
  '▣',
  '▤',
  '▥',
  '▦',
  '▧',
  '▨',
  '▩',
  '✦',
  '✧',
  '✩',
  '✪',
  '✫',
  '✬',
  '✭',
  '✮',
  '✯',
  '✰',
  '✱',
  '✲',
  '✚',
  '✜',
  '✳',
  '✴',
  '✵',
  '✶',
  '✷',
  '✸',
  '✹',
  '✺',
  '✻',
  '✼',
  '✽',
  '✾',
  '✿',
  '❀',
  '❁',
  '❂',
  '❃',
  '❄',
  '❅',
  '❆',
  '❇',
  '❈',
  '❉',
  '❊',
  '❋',
  '⚑',
  '⚐',
  '⌂',
  '⌁',
  '⌖',
  '⌘',
  '⌬',
  '∞',
  '◎',
  '◉',
  '◌',
  '⟡',
  '⟐',
  '⦿',
  '⦾',
  '⊙',
  '☰',
  '☷',
  '☯',
  '☼',
  '☾',
  '☽',
  '☀',
  '☁',
  '☂',
  '☃',
  '☕',
  '♠',
  '♥',
  '♦',
  '♣',
  '♡',
  '♢',
  '♧',
  '♤',
] as const

export function normalizeCategoryIcon(value: string) {
  return value.trim().replace(/\s+/g, '')
}

export function getDefaultCategoryIcon(name: string) {
  const seed = normalizeCategoryIcon(name)
  if (!seed) return '•'

  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }

  return CATEGORY_ICON_CHOICES[Math.abs(hash) % CATEGORY_ICON_CHOICES.length]
}

export function getCategoryDisplayIcon(category: Pick<FamilyCategory, 'icon' | 'name'> | null | undefined) {
  const customIcon = category?.icon ? normalizeCategoryIcon(category.icon) : ''
  if (customIcon) return customIcon
  return getDefaultCategoryIcon(category?.name ?? '')
}
