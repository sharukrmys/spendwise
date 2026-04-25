import { useState } from 'react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { CheckSquare, Square, ShoppingCart, Trash2, Pencil, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { formatCurrency, cn } from '@/core/utils'
import { haptics } from '@/core/haptics'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import { useConfetti } from '@/components/ui/Confetti'
import type { Task } from '@/core/types'

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onConvert?: (task: Task) => void
  compact?: boolean
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#ff6b6b',
  medium: '#f59e0b',
  low: '#8480a8',
}

function dueDateLabel(ts: number): { label: string; color: string } {
  const d = new Date(ts)
  if (isPast(d) && !isToday(d)) return { label: 'Overdue', color: '#ff6b6b' }
  if (isToday(d)) return { label: 'Today', color: '#f59e0b' }
  if (isTomorrow(d)) return { label: 'Tomorrow', color: '#00c896' }
  return { label: format(d, 'MMM d'), color: 'var(--text-3)' }
}

export function TaskCard({ task, onEdit, onConvert, compact = false }: TaskCardProps) {
  const { markDone, deleteTask, toggleItem } = useTaskStore()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()
  const [showItems, setShowItems] = useState(task.type === 'checklist' && (task.items?.length ?? 0) > 0)
  const burst = useConfetti()

  const category = categories.find(c => c.id === task.categoryId)
  const isDone = task.status === 'done'
  const priorityColor = PRIORITY_COLOR[task.priority]
  const dueDateInfo = task.dueDate ? dueDateLabel(task.dueDate) : null

  const checkedCount = task.items?.filter(i => i.checked).length ?? 0
  const totalCount = task.items?.length ?? 0

  const checklistTotal = task.items?.reduce((s, i) => {
    const qty = i.quantity ?? 1
    return s + (i.estimatedPrice ?? 0) * qty
  }, 0) ?? 0

  const displayAmount = task.type === 'checklist' && checklistTotal > 0
    ? checklistTotal
    : task.amount

  const fmt = (v: number) => formatCurrency(v, task.currency ?? settings.defaultCurrency, false)

  return (
    <SwipeableRow
      onDelete={() => { haptics.delete(); deleteTask(task.id) }}
      onEdit={!isDone && !compact ? () => onEdit(task) : undefined}
      disabled={isDone}
    >
    <div
      className={cn('relative overflow-hidden rounded-2xl transition-all', isDone && 'opacity-60')}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Priority bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: priorityColor }}
      />

      <div className="pl-4 pr-3 py-3">
        {/* Top row */}
        <div className="flex items-start gap-2.5">
          {/* Done toggle */}
          <button
            className="tap shrink-0 mt-0.5"
            onClick={() => { if (!isDone) { haptics.success(); markDone(task.id) } }}
            aria-label={isDone ? 'Done' : 'Mark done'}
          >
            {isDone
              ? <CheckSquare size={18} style={{ color: 'var(--brand)' }} />
              : <Square size={18} className="text-3" />}
          </button>

          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.type === 'checklist'
                ? <ShoppingCart size={13} className="text-brand shrink-0" />
                : null}
              <span className={cn('text-sm font-semibold text-1 leading-snug', isDone && 'line-through text-3')}>
                {task.title}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {dueDateInfo && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${dueDateInfo.color}18`, color: dueDateInfo.color }}>
                  {dueDateInfo.label}{task.dueTime ? ` ${task.dueTime}` : ''}
                </span>
              )}
              {category && (
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: category.color }}>
                  {category.icon} {category.name.split(' ')[0]}
                </span>
              )}
              {task.location && (
                <span className="text-[10px] text-3 truncate max-w-[120px]">📍 {task.location}</span>
              )}
              {displayAmount != null && displayAmount > 0 && (
                <span className="text-[10px] font-bold" style={{ color: 'var(--brand)' }}>
                  ~{fmt(displayAmount)}
                </span>
              )}
            </div>

            {/* Checklist progress */}
            {task.type === 'checklist' && totalCount > 0 && (
              <button
                className="flex items-center gap-2 mt-1.5 tap"
                onClick={() => setShowItems(v => !v)}
              >
                <div className="h-1.5 w-24 bg-card3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(checkedCount / totalCount) * 100}%`, background: checkedCount === totalCount ? 'var(--income)' : 'var(--brand)' }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-3">
                  {checkedCount}/{totalCount} done
                </span>
                {showItems
                  ? <ChevronUp size={11} className="text-3 shrink-0" />
                  : <ChevronDown size={11} className="text-3 shrink-0" />}
              </button>
            )}

            {/* Converted badge */}
            {task.convertedExpenseId && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold mt-1" style={{ color: 'var(--income)' }}>
                ✓ Logged as expense
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {!isDone && !compact && (
              <button onClick={() => onEdit(task)} className="w-7 h-7 flex items-center justify-center rounded-lg tap text-3 hover:text-1 transition-colors" style={{ background: 'var(--bg-card2)' }}>
                <Pencil size={12} />
              </button>
            )}
            {!isDone && onConvert && (task.amount || (task.type === 'checklist' && checklistTotal > 0)) && (
              <button
                onClick={() => { haptics.light(); onConvert(task) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg tap transition-colors"
                style={{ background: 'rgba(124,92,252,0.12)', color: 'var(--brand)' }}
                title="Convert to expense"
              >
                <ArrowRight size={12} />
              </button>
            )}
            <button
              onClick={() => { haptics.delete(); deleteTask(task.id) }}
              className="w-7 h-7 flex items-center justify-center rounded-lg tap text-3 hover:text-expense transition-colors"
              style={{ background: 'var(--bg-card2)' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Checklist items (expandable) */}
        {task.type === 'checklist' && showItems && task.items && task.items.length > 0 && (
          <div className="mt-2 pt-2 border-t border-ui flex flex-col gap-1">
            {task.items.map(item => (
              <button
                key={item.id}
                onClick={(e) => {
                  toggleItem(task.id, item.id)
                  haptics.light()
                  if (!item.checked) {
                    const afterToggle = (task.items ?? []).filter(i => i.id !== item.id || !i.checked)
                    const willAllBeDone = afterToggle.every(i => i.checked || i.id === item.id)
                    if (willAllBeDone && (task.items?.length ?? 0) > 1) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      burst(rect.x + rect.width / 2, rect.y)
                    }
                  }
                }}
                className="flex items-center gap-2 py-1 tap rounded-lg text-left w-full"
              >
                {item.checked
                  ? <CheckSquare size={14} style={{ color: 'var(--income)' }} className="shrink-0" />
                  : <Square size={14} className="text-3 shrink-0" />}
                <span className={cn('text-xs flex-1', item.checked ? 'line-through text-3' : 'text-2')}>
                  {item.quantity && item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
                </span>
                {item.estimatedPrice != null && item.estimatedPrice > 0 && (
                  <span className="text-[10px] text-3 shrink-0">
                    {fmt(item.estimatedPrice * (item.quantity ?? 1))}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
    </SwipeableRow>
  )
}
