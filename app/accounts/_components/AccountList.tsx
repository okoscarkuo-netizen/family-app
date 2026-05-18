'use client'

import { useState } from 'react'
import type { FamilyAccount } from '@/lib/finance/types'
import { accountGroupOrder, getAccountGroup } from '@/lib/finance/types'
import { AccountCard } from './AccountCard'
import { AccountModal } from './AccountModal'

type Props = {
  accounts: FamilyAccount[]
}

function fmt(n: number): string {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

export function AccountList({ accounts }: Props) {
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingAccount, setEditingAccount] = useState<FamilyAccount | null>(null)

  function openCreate() {
    setEditingAccount(null)
    setModalMode('create')
  }

  function openEdit(account: FamilyAccount) {
    setEditingAccount(account)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingAccount(null)
  }

  const visibleAccounts = accounts.filter(a => !a.hidden)

  const assetTotal = visibleAccounts
    .filter(a => a.kind === 'asset')
    .reduce((sum, a) => sum + a.balance, 0)
  const liabilityTotal = visibleAccounts
    .filter(a => a.kind === 'liability')
    .reduce((sum, a) => sum + a.balance, 0)
  const net = assetTotal - liabilityTotal

  const groupedAccounts = accountGroupOrder
    .map(group => ({
      group,
      items: visibleAccounts.filter(a => getAccountGroup(a) === group),
    }))
    .filter(g => g.items.length > 0)

  return (
    <>
      {/* Net Worth Bar */}
      <div className="rounded-lg border-2 border-slate-950 bg-[#00c2ff] p-4 shadow-[6px_6px_0_#111827]">
        <p className="mb-3 text-xs font-black uppercase text-slate-700">
          淨資產總覽
          {accounts.some(a => a.currency !== 'TWD') && (
            <span className="ml-2 font-semibold normal-case text-slate-600">（多幣別混算，僅供參考）</span>
          )}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border-2 border-slate-950 bg-white p-3">
            <p className="text-xs font-bold text-slate-500">資產</p>
            <p className="mt-1 text-lg font-black text-slate-950">{fmt(assetTotal)}</p>
          </div>
          <div className="rounded-md border-2 border-slate-950 bg-white p-3">
            <p className="text-xs font-bold text-slate-500">負債</p>
            <p className="mt-1 text-lg font-black text-slate-950">{fmt(liabilityTotal)}</p>
          </div>
          <div className="rounded-md border-2 border-slate-950 bg-[#fff45f] p-3">
            <p className="text-xs font-bold text-slate-500">淨值</p>
            <p className={`mt-1 text-lg font-black ${net < 0 ? 'text-red-600' : 'text-slate-950'}`}>
              {fmt(net)}
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">帳戶與資產</h2>
          <p className="mt-0.5 text-sm text-slate-500">{visibleAccounts.length} 個帳戶</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2 text-sm font-black text-white shadow-[4px_4px_0_#111827] hover:bg-[#e92b87]"
          type="button"
        >
          ＋ 新增帳戶
        </button>
      </div>

      {/* Groups */}
      <div className="space-y-6">
        {groupedAccounts.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            還沒有帳戶，點右上角「＋ 新增帳戶」開始
          </p>
        )}
        {groupedAccounts.map(({ group, items }) => (
          <div key={group}>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
              {group}
            </h3>
            <div className="space-y-2">
              {items.map(account => (
                <AccountCard key={account.id} account={account} onEdit={openEdit} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalMode && (
        <AccountModal
          mode={modalMode}
          account={editingAccount ?? undefined}
          onClose={closeModal}
        />
      )}
    </>
  )
}
