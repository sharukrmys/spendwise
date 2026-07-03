import { useMemo } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { Wallet } from 'lucide-react'
import { ExpenseItem } from './ExpenseItem'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { groupBy } from '@/core/utils'
import type { Expense } from '@/core/types'

interface ExpenseListProps {
  expenses: Expense[]
  loading?: boolean
  compact?: boolean
  onAdd?: () => void
  // Pixels to offset the sticky day header by — needed when this list is nested
  // under another sticky header (e.g. a month divider) so the two don't overlap.
  stickyOffset?: number
}

function groupLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d')
}

export function ExpenseList({ expenses, loading, compact, onAdd, stickyOffset = 0 }: ExpenseListProps) {
  const grouped = useMemo(() => {
    const byDay = groupBy(expenses, e => format(new Date(e.date), 'yyyy-MM-dd'))
    return Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a))
  }, [expenses])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Spinner size={28} />
    </div>
  )

  if (expenses.length === 0) return (
    <EmptyState
      icon={<Wallet size={40} />}
      title="No transactions yet"
      description="Tap the + button to record your first expense."
      action={onAdd ? { label: 'Add Transaction', onClick: onAdd } : undefined}
    />
  )

  return (
    <div className="flex flex-col">
      {grouped.map(([dateStr, dayExpenses]) => {
        const dayIncome = dayExpenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
        const dayExpense = dayExpenses.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
        const dayNet = dayIncome - dayExpense
        return (
          <div key={dateStr}>
            {!compact && (
              <div className="flex items-center justify-between px-4 py-2 sticky z-10 bg-base" style={{ top: stickyOffset }}>
                <span className="text-xs font-semibold text-3 uppercase tracking-wide">
                  {groupLabel(dateStr)}
                </span>
                <span className={`text-xs font-semibold ${dayNet >= 0 ? 'text-income' : 'text-expense'}`}>
                  {dayNet >= 0 ? '+' : ''}{dayNet.toFixed(2)}
                </span>
              </div>
            )}
            <div className="divide-ui">
              {dayExpenses.map(expense => (
                <ExpenseItem key={expense.id} expense={expense} compact={compact} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
