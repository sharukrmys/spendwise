import { cn } from '@/core/utils'
import type { Group } from '@/core/types'

export function SplitMemberCards({
  members, splitType, amount, currencySymbol,
  ignoredMembers, customSplits, onToggleIgnore, onCustomChange,
}: {
  members: Group['members']
  splitType: 'equal' | 'custom'
  amount: string
  currencySymbol: string
  ignoredMembers: Set<string>
  customSplits: Record<string, string>
  onToggleIgnore: (id: string) => void
  onCustomChange: (id: string, val: string) => void
}) {
  const total = parseFloat(amount) || 0
  const activeMembers = members.filter(m => !ignoredMembers.has(m.id))
  // Floor-based equal split: remainder (rounding) goes to first active member
  const base = activeMembers.length > 0 && total > 0
    ? Math.floor((total / activeMembers.length) * 100) / 100
    : 0
  const roundRem = activeMembers.length > 0 && total > 0
    ? parseFloat((total - base * activeMembers.length).toFixed(2))
    : 0
  const getEqualAmt = (id: string) => {
    if (ignoredMembers.has(id)) return 0
    return activeMembers[0]?.id === id ? base + roundRem : base
  }

  const customSum = members
    .filter(m => !ignoredMembers.has(m.id))
    .reduce((s, m) => s + (parseFloat(customSplits[m.id] ?? '0') || 0), 0)
  const remaining = total - customSum
  const pct = total > 0 ? Math.min(100, (customSum / total) * 100) : 0
  // Only warn when difference >= 1 unit; ignore sub-unit rounding
  const ok = Math.abs(remaining) < 1

  return (
    <div className="flex flex-col gap-2">
      {members.map(m => {
        const ignored = ignoredMembers.has(m.id)
        return (
          <div key={m.id}
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: ignored ? 'rgba(255,255,255,0.02)' : 'var(--bg-card2)',
              border: `1.5px solid ${ignored ? 'rgba(255,255,255,0.06)' : 'var(--border)'}`,
              opacity: ignored ? 0.5 : 1,
            }}>
            {/* Header: avatar + name + amount (equal) + exclude */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: ignored ? '#666' : m.avatarColor }}>
                {m.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold truncate', ignored ? 'text-3 line-through' : 'text-1')}>
                  {m.name}
                </p>
                {splitType === 'equal' && !ignored && total > 0 && (
                  <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--brand)' }}>
                    {currencySymbol}{getEqualAmt(m.id).toFixed(2)}
                  </p>
                )}
                {ignored && <p className="text-[10px] text-3 mt-0.5">Not in this split</p>}
              </div>
              <button
                onClick={() => onToggleIgnore(m.id)}
                className="px-2.5 py-1.5 rounded-xl tap text-[11px] font-bold shrink-0 transition-all"
                style={ignored
                  ? { background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.3)' }
                  : { background: 'rgba(255,107,107,0.08)', color: 'rgba(255,107,107,0.8)', border: '1px solid rgba(255,107,107,0.2)' }}>
                {ignored ? '+ Include' : '× Exclude'}
              </button>
            </div>
            {/* Custom amount input — full width below header */}
            {splitType === 'custom' && !ignored && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,92,252,0.1), rgba(168,85,247,0.06))',
                    border: '1.5px solid rgba(124,92,252,0.2)',
                  }}>
                  <span className="text-lg font-bold shrink-0" style={{ color: 'rgba(124,92,252,0.6)' }}>
                    {currencySymbol}
                  </span>
                  <input
                    type="number" inputMode="decimal" placeholder="0.00"
                    value={customSplits[m.id] ?? ''}
                    onChange={e => onCustomChange(m.id, e.target.value)}
                    className="flex-1 bg-transparent text-xl font-bold text-1 text-right outline-none placeholder:text-3 min-w-0"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Distribution summary — custom mode, informational only */}
      {splitType === 'custom' && total > 0 && (
        <div className="rounded-2xl px-4 py-3"
          style={{ background: 'var(--bg-card2)', border: '1.5px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-3">Distributed</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tabular-nums" style={{ color: ok ? '#00c896' : 'var(--text-1)' }}>
                {currencySymbol}{customSum.toFixed(2)}
              </span>
              <span className="text-xs text-3">of {currencySymbol}{total.toFixed(2)}</span>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: ok ? '#00c896' : remaining > 0 ? 'linear-gradient(90deg,#7c5cfc,#a855f7)' : '#ef4444' }} />
          </div>
          {!ok && (
            <p className="text-[11px] text-center mt-2 font-medium"
              style={{ color: remaining > 0 ? 'var(--text-3)' : 'var(--expense)' }}>
              {remaining > 0
                ? `${currencySymbol}${remaining.toFixed(2)} remaining`
                : `${currencySymbol}${Math.abs(remaining).toFixed(2)} over`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
