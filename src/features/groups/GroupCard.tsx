import { ArrowRight, Link, Download } from 'lucide-react'
import { useGroupStore } from '@/store/useGroupStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { formatCurrency } from '@/core/utils'
import type { Group } from '@/core/types'

export function GroupCard({ group, onOpen, onExport }: { group: Group; onOpen: () => void; onExport: () => void }) {
  const { getBalances } = useGroupStore()
  const { settings } = useSettingsStore()
  const balances = getBalances(group.id)
  const meId = group.myMemberId ?? group.members.find(m => m.name === settings.myGroupName)?.id
  const myBalance = meId ? (balances[meId] ?? 0) : null

  return (
    <div className="flex items-center gap-3 w-full p-4 card">
    <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 tap text-left">
      <div className="w-11 h-11 grad-brand rounded-2xl flex items-center justify-center shrink-0">
        <span className="text-xl font-bold text-white">{group.name[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-1">{group.name}</p>
        <p className="text-xs text-2">{group.members.length} members · {group.currency}</p>
      </div>
      {group.shareCode && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-brand px-2 py-0.5 rounded-lg mr-1" style={{ background: 'rgba(124,92,252,0.12)' }}>
          <Link size={9} /> Shared
        </span>
      )}
      {myBalance !== null && myBalance !== 0 && (
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-lg mr-1 shrink-0 tabular-nums"
          style={{
            background: myBalance > 0 ? 'rgba(0,200,150,0.12)' : 'rgba(255,107,107,0.12)',
            color: myBalance > 0 ? '#00c896' : '#ff6b6b',
          }}
        >
          {myBalance > 0
            ? `owed ${formatCurrency(myBalance, group.currency)}`
            : `owes ${formatCurrency(Math.abs(myBalance), group.currency)}`}
        </span>
      )}
      <ArrowRight size={16} className="text-3 shrink-0" />
    </button>
    <button
      onClick={e => { e.stopPropagation(); onExport() }}
      className="w-8 h-8 flex items-center justify-center rounded-xl tap shrink-0"
      style={{ background: 'rgba(0,200,150,0.1)' }}
      title="Export group to file"
    >
      <Download size={14} className="text-income" />
    </button>
    </div>
  )
}
