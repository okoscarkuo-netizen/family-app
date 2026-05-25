'use client'

import { useState } from 'react'
import type { FamilyAccount } from '@/lib/finance/types'
import { AccountModal } from './AccountModal'

type Props = {
  account: FamilyAccount
}

function HexEditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M8.3 4.6h7.4L20 10.2 15.7 19.4H8.3L4 10.2 8.3 4.6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m9.8 14.3 4.4-4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m13.7 8.7 1.6 1.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function AccountEditButton({ account }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-[0.95rem] border border-[#e4d9c7] bg-[#fbfaf7] text-slate-500 shadow-[0_4px_10px_rgba(15,23,42,0.04)] transition hover:border-[#d8c7b0] hover:bg-white hover:text-[#15957d]"
        aria-label={`編輯 ${account.name}`}
        title="編輯帳戶"
      >
        <HexEditIcon />
      </button>

      {isOpen ? (
        <AccountModal
          mode="edit"
          account={account}
          onClose={() => {
            setIsOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
