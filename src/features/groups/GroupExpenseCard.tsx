import { format } from 'date-fns'
import { HandCoins, Check } from 'lucide-react'
import { cn, formatCurrency } from '@/core/utils'
import type { Group, GroupExpense, Category } from '@/core/types'

export function GroupExpenseCard({ expense, members, currency, categories, onEdit, onDelete, onSettle, onUnsettle, onInvalidate }: {
  expense: GroupExpense
  members: Group['members']
  currency: string
  categories: Category[]
  onEdit: () => void
  onDelete: () => void
  onSettle: (memberId: string) => void
  onUnsettle: (memberId: string) => void
  onInvalidate?: () => void
}) {
  // Settlement payment record — solid card with Void option
  if (expense.notes === '__settlement__') {
    const debtor = members.find(m => m.id === expense.paidBy)
    const creditor = members.find(m => m.id === expense.splits[0]?.memberId)
    const voided = expense.invalidated === true
    return (
      <div className={cn('card overflow-hidden', voided && 'opacity-60')}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: voided ? 'rgba(255,255,255,0.06)' : 'rgba(0,200,150,0.12)' }}>
            <HandCoins size={17} style={{ color: voided ? 'var(--text-3)' : '#00c896' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold text-1', voided && 'line-through text-3')}>
                {debtor?.name} paid {creditor?.name}
              </p>
              {voided && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0"
                  style={{ background: 'rgba(255,107,107,0.12)', color: 'rgba(255,107,107,0.75)' }}>
                  Voided
                </span>
              )}
            </div>
            <p className="text-[10px] mt-0.5 text-3">
              Settlement · {expense.date ? format(new Date(expense.date), 'MMM d, h:mm a') : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-sm font-bold tabular-nums', voided ? 'text-3 line-through' : 'text-income')}>
              {formatCurrency(expense.amount, currency)}
            </span>
            {!voided && onInvalidate && (
              <button
                onClick={onInvalidate}
                className="tap text-[10px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,107,107,0.07)', color: 'rgba(255,107,107,0.65)', border: '1px solid rgba(255,107,107,0.15)' }}>
                Void
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const cat = categories.find(c => c.id === expense.categoryId)
  const payer = members.find(m => m.id === expense.paidBy)
  const settledCount = expense.splits.filter(s => s.settled).length
  const totalCount = expense.splits.length
  const settledPct = totalCount > 0 ? Math.round((settledCount / totalCount) * 100) : 0

  return (
    <div className="card overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            {cat && (
              <span className="text-xs px-2 py-0.5 rounded-lg font-medium shrink-0"
                style={{ background: `${cat.color}20`, color: cat.color }}>
                {cat.icon} {cat.name}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-1">{expense.description}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>
            Paid by <span style={{ color: payer?.avatarColor ?? 'var(--brand)' }}>{payer?.name ?? 'Unknown'}</span>
            {expense.date ? ` · ${format(new Date(expense.date), 'MMM d, h:mm a')}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0 ml-3 flex flex-col items-end gap-1">
          <p className="text-base font-bold" style={{ color: '#f0eeff' }}>{formatCurrency(expense.amount, currency)}</p>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="text-[10px] tap font-medium" style={{ color: 'rgba(124,92,252,0.8)' }}>Edit</button>
            <button onClick={onDelete} className="text-[10px] tap" style={{ color: 'rgba(255,107,107,0.6)' }}>Remove</button>
          </div>
          {expense.updatedAt && (
            <p className="text-[9px]" style={{ color: 'rgba(200,195,240,0.3)' }}>
              edited {format(new Date(expense.updatedAt), 'MMM d, h:mm a')}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mx-4" style={{ background: 'var(--border)' }} />

      {/* Split rows */}
      <div className="px-4 py-2 flex flex-col gap-2">
        {expense.splits.map(split => {
          const member = members.find(m => m.id === split.memberId)
          const settledByMember = members.find(m => m.id === split.settledBy)
          return (
            <div key={split.memberId}>
              <div className="flex items-center gap-3 py-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: member?.avatarColor ?? '#7c5cfc' }}
                >
                  {member?.name[0].toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-1">{member?.name}</p>
                  {/* Settlement log */}
                  {split.settled && split.settledAt && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(0,200,150,0.6)' }}>
                      Settled {format(new Date(split.settledAt), 'MMM d, h:mm a')}
                      {settledByMember && settledByMember.id !== split.memberId ? ` · by ${settledByMember.name}` : ''}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold text-1 mr-1">{formatCurrency(split.amount, currency)}</span>
                {split.settled ? (
                  <div className="flex items-center gap-1">
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(0,200,150,0.12)', color: '#00c896' }}>
                      <Check size={10} /> Settled
                    </span>
                    {/* Undo button */}
                    <button
                      onClick={() => onUnsettle(split.memberId)}
                      className="text-[10px] font-semibold px-1.5 py-1 rounded-lg tap"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(200,195,240,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                      title="Undo settlement"
                    >
                      ↩
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onSettle(split.memberId)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg tap"
                    style={{ background: 'rgba(124,92,252,0.15)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.25)' }}
                  >
                    Settle Up
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Settled progress bar */}
      <div className="px-4 pb-4 pt-1">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(200,195,240,0.45)' }}>{settledPct}% Settled</span>
          <span className="text-[10px]" style={{ color: 'rgba(200,195,240,0.35)' }}>{settledCount}/{totalCount}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${settledPct}%`,
              background: settledPct === 100 ? '#00c896' : 'linear-gradient(90deg,#7c5cfc,#a855f7)'
            }}
          />
        </div>
      </div>
    </div>
  )
}
