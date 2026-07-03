import { Scale, PenLine } from 'lucide-react'
import { cn } from '@/core/utils'
import type { Group } from '@/core/types'

/** "Who paid?" member picker + Equal/Custom split-type toggle — shared between
 * group-mode and the personal-expense "add to group" split picker. */
export function PaidBySplitRow({
  members, paidBy, onPaidByChange, splitType, onSplitTypeChange, memberBg = 'var(--bg-card2)',
}: {
  members: Group['members']
  paidBy: string
  onPaidByChange: (id: string) => void
  splitType: 'equal' | 'custom'
  onSplitTypeChange: (t: 'equal' | 'custom') => void
  memberBg?: string
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-1.5">Who paid?</p>
        <div className="flex gap-1.5 flex-wrap">
          {members.map(m => (
            <button key={m.id} onClick={() => onPaidByChange(m.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl tap transition-all"
              style={paidBy === m.id
                ? { background: `${m.avatarColor}25`, border: `1.5px solid ${m.avatarColor}60` }
                : { background: memberBg, border: '1.5px solid var(--border)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: m.avatarColor }}>
                {m.name[0].toUpperCase()}
              </div>
              <span className="text-xs font-semibold"
                style={{ color: paidBy === m.id ? m.avatarColor : 'var(--text-2)' }}>
                {m.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="shrink-0">
        <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-1.5">Split</p>
        <div className="flex gap-1.5">
          {(['equal', 'custom'] as const).map(t => (
            <button key={t} onClick={() => onSplitTypeChange(t)}
              className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl tap transition-all',
                splitType === t ? 'grad-brand text-white' : 'bg-card2 text-2')}>
              {t === 'equal' ? <Scale size={12} /> : <PenLine size={12} />}
              {t === 'equal' ? 'Equal' : 'Custom'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
