import { useEffect, useState, useMemo } from 'react'
import {
  format, isSameDay, isToday, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, addWeeks, subWeeks, addDays, isThisWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, CheckSquare, Square, ShoppingCart, ListTodo } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ExpenseItem } from '@/features/expenses/ExpenseItem'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTaskStore } from '@/store/useTaskStore'
import { expenseQueries } from '@/db/queries'
import { formatCurrency, buildDailyHeatmap, cn } from '@/core/utils'
import type { Expense, Task } from '@/core/types'

type CalView = 'month' | 'week'

export function CalendarPage() {
  const { settings } = useSettingsStore()
  const [view, setView] = useState<CalView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: settings.firstDayOfWeek })
  )
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayExpenses, setDayExpenses] = useState<Expense[]>([])
  const [dayTasks, setDayTasks] = useState<Task[]>([])
  const [dayModalOpen, setDayModalOpen] = useState(false)
  const [dayModalTab, setDayModalTab] = useState<'expenses' | 'tasks'>('expenses')
  const [weekSelectedDay, setWeekSelectedDay] = useState<Date | null>(null)

  const { tasks, load: loadTasks, markDone, toggleItem } = useTaskStore()

  useEffect(() => { loadTasks() }, [])

  // Build task due-date map: 'yyyy-MM-dd' → count
  const taskDateMap = useMemo(() => {
    const map: Record<string, number> = {}
    tasks.forEach(t => {
      if (t.status === 'pending' && t.dueDate) {
        const key = format(new Date(t.dueDate), 'yyyy-MM-dd')
        map[key] = (map[key] ?? 0) + 1
      }
    })
    return map
  }, [tasks])

  // Load expenses based on view
  useEffect(() => {
    if (view === 'month') {
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      expenseQueries.getByRange(start.getTime(), end.getTime()).then(setExpenses)
    } else {
      const end = addDays(weekStart, 6)
      expenseQueries.getByRange(weekStart.getTime(), end.getTime() + 86399999).then(setExpenses)
    }
  }, [currentDate, view, weekStart])

  const heatmap = useMemo(() => buildDailyHeatmap(expenses, currentDate), [expenses, currentDate])
  const maxAmount = Math.max(...Object.values(heatmap), 1)

  // Month grid
  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(currentDate)
    const lastDay = endOfMonth(currentDate)
    const gridStart = startOfWeek(firstDay, { weekStartsOn: settings.firstDayOfWeek })
    const gridEnd = endOfWeek(lastDay, { weekStartsOn: settings.firstDayOfWeek })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentDate, settings.firstDayOfWeek])

  // Week days
  const weekDays = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  }, [weekStart])

  // Week heatmap (expense only)
  const weekHeatmap = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.filter(e => e.type !== 'income').forEach(e => {
      const key = format(new Date(e.date), 'yyyy-MM-dd')
      map[key] = (map[key] ?? 0) + e.amount
    })
    return map
  }, [expenses])

  const weekTotal = weekDays.reduce((s, d) => s + (weekHeatmap[format(d, 'yyyy-MM-dd')] ?? 0), 0)

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentDate)) return
    const dayStr = format(day, 'yyyy-MM-dd')
    const amount = heatmap[dayStr] ?? 0
    const taskCount = taskDateMap[dayStr] ?? 0
    if (amount === 0 && !isToday(day) && taskCount === 0) return
    setSelectedDay(day)
    setDayExpenses(expenses.filter(e => isSameDay(new Date(e.date), day)))
    setDayTasks(tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), day)))
    setDayModalTab('expenses')
    setDayModalOpen(true)
  }

  const monthTotal = Object.values(heatmap).reduce((s, v) => s + v, 0)
  const daysWithExpenses = Object.values(heatmap).filter(v => v > 0).length

  const weekDayLabels = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const start = settings.firstDayOfWeek
    return [...days.slice(start), ...days.slice(0, start)]
  })()

  const isCurrentMonth = format(currentDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
  const isCurrentWeek = isThisWeek(weekStart, { weekStartsOn: settings.firstDayOfWeek })

  const weekFilteredExpenses = useMemo(() => {
    if (!weekSelectedDay) return expenses.filter(e => e.type !== 'income')
    return expenses.filter(e => e.type !== 'income' && isSameDay(new Date(e.date), weekSelectedDay))
  }, [expenses, weekSelectedDay])

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* ─── Header ───────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-4">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(200,195,240,0.6)' }}>Calendar</p>

        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
          {(['month', 'week'] as CalView[]).map(v => (
            <button
              key={v}
              onClick={() => {
                setView(v)
                setWeekSelectedDay(null)
                if (v === 'week') setWeekStart(startOfWeek(new Date(), { weekStartsOn: settings.firstDayOfWeek }))
              }}
              className={cn(
                'flex-1 py-2 text-sm font-semibold rounded-lg tap transition-all capitalize',
                view === v ? 'grad-brand text-white shadow' : ''
              )}
              style={view !== v ? { color: 'rgba(200,195,240,0.7)' } : undefined}
            >
              {v === 'month' ? 'Month' : 'Week'}
            </button>
          ))}
        </div>

        {/* Navigator */}
        {view === 'month' ? (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl tap"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronLeft size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
            </button>
            <div className="text-center">
              <p className="text-lg font-bold" style={{ color: '#f0eeff' }}>{format(currentDate, 'MMMM yyyy')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(200,195,240,0.6)' }}>
                {formatCurrency(monthTotal, settings.defaultCurrency)} · {daysWithExpenses} days
              </p>
            </div>
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              disabled={isCurrentMonth}
              className="w-9 h-9 flex items-center justify-center rounded-xl tap disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronRight size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setWeekStart(d => subWeeks(d, 1)); setWeekSelectedDay(null) }}
              className="w-9 h-9 flex items-center justify-center rounded-xl tap"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronLeft size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
            </button>
            <div className="text-center">
              <p className="text-lg font-bold" style={{ color: '#f0eeff' }}>
                {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(200,195,240,0.6)' }}>
                {formatCurrency(weekTotal, settings.defaultCurrency)} this week
              </p>
            </div>
            <button
              onClick={() => { setWeekStart(d => addWeeks(d, 1)); setWeekSelectedDay(null) }}
              disabled={isCurrentWeek}
              className="w-9 h-9 flex items-center justify-center rounded-xl tap disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ChevronRight size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-28">
        {/* ─── Month View ───────────────────────── */}
        {view === 'month' && (
          <>
            <div className="card p-4">
              <div className="grid grid-cols-7 mb-1">
                {weekDayLabels.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-3 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(day => {
                  const dayStr = format(day, 'yyyy-MM-dd')
                  const amount = heatmap[dayStr] ?? 0
                  const intensity = amount > 0 ? Math.max(0.18, amount / maxAmount) : 0
                  const inMonth = isSameMonth(day, currentDate)
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                  const todayDay = isToday(day)
                  return (
                    <button
                      key={dayStr}
                      onClick={() => handleDayClick(day)}
                      disabled={!inMonth}
                      className={cn(
                        'relative aspect-square rounded-xl flex flex-col items-center justify-center tap transition-all',
                        !inMonth && 'opacity-15',
                        isSelected && 'ring-2 ring-brand',
                        todayDay && !isSelected && 'ring-1 ring-white/20',
                      )}
                      style={amount > 0 && inMonth ? { backgroundColor: `rgba(124,92,252,${intensity * 0.65})` } : undefined}
                    >
                      <span className={cn('text-xs font-semibold leading-tight', todayDay ? 'text-brand' : amount > 0 ? 'text-white' : 'text-2')}>
                        {format(day, 'd')}
                      </span>
                      <div className="flex gap-0.5 mt-0.5 items-center justify-center">
                        {amount > 0 && inMonth && <div className="w-1 h-1 rounded-full bg-white/60" />}
                        {inMonth && (taskDateMap[format(day, 'yyyy-MM-dd')] ?? 0) > 0 && (
                          <div className="w-1 h-1 rounded-full" style={{ background: '#a855f7' }} />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-[10px] text-3">Less</span>
                {[0.1, 0.3, 0.5, 0.7, 1.0].map(i => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(124,92,252,${i * 0.65})` }} />
                ))}
                <span className="text-[10px] text-3">More</span>
              </div>
            </div>

            {/* Top spend days */}
            {expenses.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 pt-3 pb-2">
                  <p className="text-sm font-semibold text-1">Top Spend Days</p>
                </div>
                <div className="flex flex-col">
                  {Object.entries(heatmap)
                    .filter(([, v]) => v > 0)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([date, amount], i, arr) => {
                      const dayExps = expenses.filter(e => format(new Date(e.date), 'yyyy-MM-dd') === date)
                      return (
                        <div key={date} className={cn('flex items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-b border-ui')}>
                          <div className="w-9 h-9 icon-circle shrink-0 grad-brand" style={{ borderRadius: '0.75rem' }}>
                            <span className="text-sm font-bold text-white">{format(new Date(date), 'd')}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-1">{format(new Date(date), 'EEEE, MMM d')}</p>
                            <p className="text-xs text-3">{dayExps.length} transaction{dayExps.length !== 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-sm font-bold text-expense">
                            {formatCurrency(amount, settings.defaultCurrency, false)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {expenses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-5xl mb-3">📅</div>
                <p className="text-base font-semibold text-1 mb-1">No expenses this month</p>
                <p className="text-sm text-2">Add expenses to see the calendar heatmap.</p>
              </div>
            )}
          </>
        )}

        {/* ─── Week View ────────────────────────── */}
        {view === 'week' && (
          <>
            {/* 7-day strip */}
            <div className="card p-3">
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(day => {
                  const dayStr = format(day, 'yyyy-MM-dd')
                  const amount = weekHeatmap[dayStr] ?? 0
                  const isSelected = weekSelectedDay ? isSameDay(day, weekSelectedDay) : false
                  const todayDay = isToday(day)
                  return (
                    <button
                      key={dayStr}
                      onClick={() => setWeekSelectedDay(isSelected ? null : day)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 py-2 rounded-xl tap transition-all',
                        isSelected && 'ring-2 ring-brand',
                        !isSelected && todayDay && 'ring-1 ring-brand/40',
                      )}
                      style={isSelected ? { background: 'rgba(124,92,252,0.15)' } : amount > 0 ? { background: 'rgba(124,92,252,0.08)' } : undefined}
                    >
                      <span className="text-[10px] font-medium text-3">{format(day, 'E')}</span>
                      <span className={cn('text-sm font-bold', isSelected ? 'text-brand' : todayDay ? 'text-brand' : 'text-1')}>
                        {format(day, 'd')}
                      </span>
                      {amount > 0 ? (
                        <span className="text-[9px] text-expense font-medium leading-none">
                          {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-[9px] leading-none opacity-0">-</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {weekSelectedDay && (
                <div className="mt-2 pt-2 border-t border-ui flex items-center justify-between">
                  <span className="text-xs text-3">{format(weekSelectedDay, 'EEEE, MMM d')}</span>
                  <button onClick={() => setWeekSelectedDay(null)} className="text-xs text-brand tap">Clear</button>
                </div>
              )}
            </div>

            {/* Week expense list grouped by day */}
            {weekFilteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-base font-semibold text-1 mb-1">
                  {weekSelectedDay ? 'No expenses on this day' : 'No expenses this week'}
                </p>
              </div>
            ) : (
              weekDays.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd')
                const dayExps = weekFilteredExpenses.filter(e => format(new Date(e.date), 'yyyy-MM-dd') === dayStr)
                if (dayExps.length === 0) return null
                const dayTotal = dayExps.reduce((s, e) => s + e.amount, 0)
                return (
                  <div key={dayStr} className="card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-ui">
                      <span className="text-xs font-semibold text-3">
                        {isToday(day) ? 'Today' : format(day, 'EEEE, MMM d')}
                      </span>
                      <span className="text-xs font-bold text-expense">
                        {formatCurrency(dayTotal, settings.defaultCurrency, false)}
                      </span>
                    </div>
                    {dayExps.map(e => <ExpenseItem key={e.id} expense={e} compact />)}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {/* Day detail modal (month view) */}
      <Modal
        open={dayModalOpen}
        onClose={() => { setDayModalOpen(false); setSelectedDay(null) }}
        title={selectedDay ? format(selectedDay, 'EEEE, MMM d') : ''}
        showClose
        size="md"
      >
        <div className="pb-4">
          {/* Tab switcher — only show if both have data */}
          {(dayExpenses.length > 0 || dayTasks.length > 0) && (
            <div className="flex gap-1 p-1 mx-4 mt-2 mb-3 rounded-xl" style={{ background: 'var(--bg-card2)' }}>
              <button
                onClick={() => setDayModalTab('expenses')}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg tap transition-all', dayModalTab === 'expenses' ? 'grad-brand text-white shadow' : 'text-2')}
              >
                💳 Expenses {dayExpenses.length > 0 && <span className="text-[9px] opacity-70">({dayExpenses.length})</span>}
              </button>
              <button
                onClick={() => setDayModalTab('tasks')}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg tap transition-all', dayModalTab === 'tasks' ? 'grad-brand text-white shadow' : 'text-2')}
              >
                ☑ Tasks {dayTasks.length > 0 && <span className="text-[9px] opacity-70">({dayTasks.length})</span>}
              </button>
            </div>
          )}

          {dayModalTab === 'expenses' ? (
            dayExpenses.length > 0 ? (
              <>
                <div className="px-4 py-3 border-b border-ui">
                  <p className="text-2xl font-bold text-expense">
                    {formatCurrency(
                      dayExpenses.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0),
                      settings.defaultCurrency, settings.showCents
                    )}
                  </p>
                  <p className="text-xs text-3">{dayExpenses.length} transaction{dayExpenses.length !== 1 ? 's' : ''}</p>
                </div>
                <div>{dayExpenses.map(e => <ExpenseItem key={e.id} expense={e} />)}</div>
              </>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-4xl mb-2">🎉</p>
                <p className="text-sm font-medium text-1">No expenses this day!</p>
              </div>
            )
          ) : (
            dayTasks.length > 0 ? (
              <div className="px-4 flex flex-col gap-2">
                {dayTasks.map(task => (
                  <DayTaskRow key={task.id} task={task} onToggleDone={() => markDone(task.id)} onToggleItem={toggleItem} />
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-4xl mb-2">✅</p>
                <p className="text-sm font-medium text-1">No tasks due this day!</p>
              </div>
            )
          )}
        </div>
      </Modal>
    </div>
  )
}

// ─── Day Task Row (used in modal) ─────────────────────────────────────────────
function DayTaskRow({ task, onToggleDone, onToggleItem }: {
  task: Task
  onToggleDone: () => void
  onToggleItem: (taskId: string, itemId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isDone = task.status === 'done'
  const checkedCount = task.items?.filter(i => i.checked).length ?? 0
  const totalCount = task.items?.length ?? 0

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button onClick={onToggleDone} className="tap shrink-0">
          {isDone
            ? <CheckSquare size={16} style={{ color: 'var(--brand)' }} />
            : <Square size={16} className="text-3" />}
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {task.type === 'checklist'
            ? <ShoppingCart size={12} style={{ color: 'var(--brand)' }} className="shrink-0" />
            : <ListTodo size={12} style={{ color: 'var(--brand)' }} className="shrink-0" />}
          <span className={cn('text-sm font-semibold text-1 truncate', isDone && 'line-through text-3')}>
            {task.title}
          </span>
        </div>
        {task.type === 'checklist' && totalCount > 0 && (
          <button onClick={() => setExpanded(v => !v)} className="text-[10px] text-3 font-semibold tap shrink-0">
            {checkedCount}/{totalCount}
          </button>
        )}
      </div>
      {expanded && task.items && task.items.length > 0 && (
        <div className="px-3 pb-2 border-t border-ui flex flex-col gap-1 pt-1.5">
          {task.items.map(item => (
            <button
              key={item.id}
              onClick={() => onToggleItem(task.id, item.id)}
              className="flex items-center gap-2 py-0.5 tap text-left w-full"
            >
              {item.checked
                ? <CheckSquare size={13} style={{ color: 'var(--income)' }} className="shrink-0" />
                : <Square size={13} className="text-3 shrink-0" />}
              <span className={cn('text-xs flex-1', item.checked ? 'line-through text-3' : 'text-2')}>
                {item.quantity && item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
