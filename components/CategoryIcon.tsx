'use client'

import { Icon } from '@iconify/react'

export function CategoryIcon({
  icon,
  size = 24,
  className,
}: {
  icon: string | null | undefined
  size?: number
  className?: string
}) {
  const value = (icon ?? '').trim()
  if (!value) {
    return (
      <span style={{ fontSize: size, lineHeight: 1 }} className={className} aria-hidden>
        ⭐
      </span>
    )
  }
  // Custom SVG from public/category-icons/
  if (value.startsWith('svg:')) {
    const filename = value.slice(4)
    return (
      <img
        src={`/category-icons/${filename}.svg`}
        width={size}
        height={size}
        className={className}
        alt=""
      />
    )
  }
  // Iconify icon names always contain a colon (e.g. "twemoji:red-apple")
  if (value.includes(':')) {
    return <Icon icon={value} width={size} height={size} className={className} />
  }
  // Legacy emoji or plain text
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} className={className} aria-hidden>
      {value}
    </span>
  )
}
