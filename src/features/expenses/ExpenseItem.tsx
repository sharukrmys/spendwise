import { useState } from 'react'
import { Trash2, Pencil, RefreshCw, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/core/utils'
import { PAYMENT_METHOD_ICONS } from '@/core/constants'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from './ExpenseForm'
import { toast } from '@/components/ui/Toast'
import type { Expense } from '@/core/types'

interface ExpenseItemProps {
  expense: Expense
  compact?: boolean
}

export function ExpenseItem({ expense, compact }: ExpenseItemProps) {
  const { deleteExpense, load } = useExpenseStore()
  const { getCategoryById } = useCategoryStore()
  const { settings } = useSettingsStore()
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const category = getCategoryById(expense.categoryId)
  const isIncome = expense.type === 'income'
  const iconBg = isIncome ? 'rgba(0,200,150,0.15)' : `${category?.color ?? '#7c5cfc'}18`
  const icon = isIncome ? '💰' : (category?.icon ?? '📦')

  const handleDelete = async () => {
    await deleteExpense(expense.id)
    await load()
    toast.success('Deleted')
    setDeleteConfirm(false)
    setDetailOpen(false)
  }

  return (
    <>
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
            {expense.notes || (isIncome ? 'Income' : (category?.name ?? 'Expense'))}
          </p>
          <p className="text-xs text-2 mt-0.5 flex items-center gap-1.5 truncate">
            <span>{PAYMENT_METHOD_ICONS[expense.paymentMethod]}</span>
            <span>{formatDate(expense.date, 'h:mm a')}</span>
            {!compact && <span className="text-3">· {category?.name}</span>}
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
              { label: 'Payment',     value: `${PAYMENT_METHOD_ICONS[expense.paymentMethod]} ${expense.paymentMethod.replace('_', ' ')}` },
              { label: 'Currency',    value: expense.currency },
              ...(expense.notes ? [{ label: 'Notes', value: expense.notes }] : []),
              ...(expense.isRecurring ? [{ label: 'Recurring', value: `Every ${expense.recurrence?.interval ?? 'month'}` }] : []),
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-2">{row.label}</span>
                <span className="text-sm font-medium text-1 capitalize">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              onClick={() => { setDetailOpen(false); setTimeout(() => setEditOpen(true), 100) }}
              className="btn btn-ghost flex-1 text-sm py-3"
            >
              <Pencil size={15} /> Edit
            </button>
            <button
              onClick={() => { setDetailOpen(false); setTimeout(() => setDeleteConfirm(true), 100) }}
              className="btn btn-danger flex-1 text-sm py-3"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Transaction">
        <ExpenseForm onClose={() => setEditOpen(false)} expense={expense} />
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete?" size="sm">
        <div className="px-5 py-4 pb-6">
          <p className="text-sm text-2 mb-5 text-center">
            Remove <strong className="text-1">{formatCurrency(expense.amount, expense.currency)}</strong> from <strong className="text-1">{category?.name}</strong>? This can't be undone.
          </p>
          <div className="flex gap-2.5">
            <button className="btn btn-ghost flex-1 py-3 text-sm" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <button className="btn flex-1 py-3 text-sm text-white font-semibold rounded-2xl" style={{ background: 'linear-gradient(135deg, #ff6b6b, #ee3c3c)' }} onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
