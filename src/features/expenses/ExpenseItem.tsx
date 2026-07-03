import { useState } from 'react'
import { Trash2, Pencil, RefreshCw, ChevronRight, Users } from 'lucide-react'
import { formatCurrency, formatDate, formatRelativeDateTime, cn } from '@/core/utils'
import { PaymentMethodIcon } from '@/components/ui/PaymentMethodIcon'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGroupStore } from '@/store/useGroupStore'
import { Modal } from '@/components/ui/Modal'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import { ExpenseForm } from './ExpenseForm'
import { toast } from '@/components/ui/Toast'
import { haptics } from '@/core/haptics'
import type { Expense } from '@/core/types'

interface ExpenseItemProps {
  expense: Expense
  compact?: boolean
}

export function ExpenseItem({ expense, compact }: ExpenseItemProps) {
  const { deleteExpense, undoDeleteExpense } = useExpenseStore()
  const { getCategoryById } = useCategoryStore()
  const { settings } = useSettingsStore()
  const { groups, deleteGroupExpense } = useGroupStore()
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const category = getCategoryById(expense.categoryId)
  const linkedGroup = expense.groupId ? groups.find(g => g.id === expense.groupId) : null
  const isSynthetic = expense.id.startsWith('grp-')
  const isIncome = expense.type === 'income'
  const iconBg = isIncome ? 'rgba(0,200,150,0.15)' : `${category?.color ?? '#7c5cfc'}18`
  const icon = isIncome ? '💰' : (category?.icon ?? '📦')

  const handleDelete = async () => {
    haptics.delete()
    if (isSynthetic && expense.groupId) {
      await deleteGroupExpense(expense.groupId, expense.id.slice(4))
      toast.success('Removed from group')
    } else {
      deleteExpense(expense.id)
      toast.undo('Expense deleted', () => undoDeleteExpense(expense.id))
    }
    setDetailOpen(false)
  }

  return (
    <>
      <SwipeableRow
        onDelete={handleDelete}
        onEdit={isSynthetic ? undefined : () => setEditOpen(true)}
      >
        <button
          onClick={() => setDetailOpen(true)}
          className={cn(
            'flex items-center gap-3 w-full tap transition-colors hover:bg-card2',
            compact ? 'py-2.5 px-4' : 'py-3.5 px-4'
          )}
        >
          {/* Icon */}
          <div
            className="icon-circle shrink-0 text-lg"
            style={{ width: 44, height: 44, borderRadius: '0.875rem', background: iconBg }}
          >
            <span>{icon}</span>
            {expense.isRecurring && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-brand flex items-center justify-center">
                <RefreshCw size={7} className="text-white" />
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-1 truncate leading-tight">
              {linkedGroup && <span style={{ color: '#7c5cfc' }}>{linkedGroup.name}: </span>}
              {expense.notes || (isIncome ? 'Income' : (category?.name ?? 'Expense'))}
            </p>
            <p className="text-xs text-2 mt-0.5 flex items-center gap-1.5 min-w-0">
              <PaymentMethodIcon method={expense.paymentMethod} size={11} className="shrink-0" />
              <span className="shrink-0">{formatRelativeDateTime(expense.date)}</span>
              {!compact && category?.name && (
                <span className="text-3 truncate min-w-0">· {category.name}</span>
              )}
            </p>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-1 shrink-0">
            <span className={cn('text-sm font-bold', isIncome ? 'text-income' : 'text-expense')}>
              {isIncome ? '+' : '-'}{formatCurrency(expense.amount, expense.currency, settings.showCents)}
            </span>
            <ChevronRight size={14} className="text-3" />
          </div>
        </button>
      </SwipeableRow>

      {/* Detail sheet */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="" showClose size="sm">
        <div className="px-5 py-2 pb-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center py-4">
            <div className="icon-circle w-16 h-16 text-3xl mb-3" style={{ borderRadius: '1.25rem', background: iconBg }}>
              <span>{icon}</span>
            </div>
            <p className={cn('text-3xl font-bold mb-1', isIncome ? 'text-income' : 'text-expense')}>
              {isIncome ? '+' : '-'}{formatCurrency(expense.amount, expense.currency, settings.showCents)}
            </p>
            <p className="text-sm text-2">{isIncome ? 'Income' : category?.name}</p>
          </div>

          {/* Receipt image */}
          {expense.attachments && expense.attachments.length > 0 && (
            <div className="mb-4 -mx-1">
              <img
                src={expense.attachments[0]}
                alt="Receipt"
                className="w-full rounded-2xl object-cover"
                style={{ maxHeight: 200 }}
              />
            </div>
          )}

          {/* Details */}
          <div className="card2 rounded-2xl divide-y divide-ui mb-4">
            {[
              { label: 'Date & time', value: formatDate(expense.date, 'EEE, MMM d, yyyy · h:mm a') },
              { label: 'Payment', value: expense.paymentMethod.replace('_', ' '), icon: <PaymentMethodIcon method={expense.paymentMethod} size={13} /> },
              { label: 'Currency', value: expense.currency },
              ...(expense.notes ? [{ label: 'Notes', value: expense.notes }] : []),
              ...(expense.isRecurring ? [{ label: 'Recurring', value: `Every ${expense.recurrence?.interval ?? 'month'}` }] : []),
              ...(linkedGroup ? [{ label: 'Group', value: linkedGroup.name, icon: <Users size={13} /> }] : []),
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-2">{row.label}</span>
                <span className="text-sm font-medium text-1 capitalize flex items-center gap-1.5">
                  {'icon' in row && row.icon}
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5">
            {!isSynthetic && (
              <button
                onClick={() => { setDetailOpen(false); setTimeout(() => setEditOpen(true), 100) }}
                className="btn btn-ghost flex-1 text-sm py-3"
              >
                <Pencil size={15} /> Edit
              </button>
            )}
            <button
              onClick={handleDelete}
              className="btn btn-danger flex-1 text-sm py-3"
            >
              <Trash2 size={15} /> {isSynthetic ? 'Remove from group' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Transaction">
        <ExpenseForm onClose={() => setEditOpen(false)} expense={expense} />
      </Modal>
    </>
  )
}
