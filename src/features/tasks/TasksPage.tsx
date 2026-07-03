import { useEffect, useState, useMemo } from 'react'
import { Plus, Search, X, CheckCircle2, ListChecks, ShoppingCart, Trophy, type LucideIcon } from 'lucide-react'
import { isPast, isToday } from 'date-fns'
import { Modal } from '@/components/ui/Modal'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'
import { useTaskStore } from '@/store/useTaskStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/core/utils'
import type { Task } from '@/core/types'

type TabType = 'all' | 'todo' | 'checklist' | 'done'

export function TasksPage() {
  const { tasks, load, filter, setFilter } = useTaskStore()
  const { load: loadExpenses } = useExpenseStore()
  const { convertToExpense } = useTaskStore()

  const [tab, setTab] = useState<TabType>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | undefined>()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [, setConvertingId] = useState<string | null>(null)

  useEffect(() => {
    setFilter({ search: undefined })
    setSearch('')
    load()
  }, [])

  useEffect(() => {
    setFilter({ search: search || undefined })
  }, [search])

  const openAdd = () => { setEditTask(undefined); setFormOpen(true) }
  const openEdit = (task: Task) => { setEditTask(task); setFormOpen(true) }

  const handleConvert = async (task: Task) => {
    setConvertingId(task.id)
    try {
      await convertToExpense(task.id)
      await loadExpenses()
      toast.success('Logged as expense')
    } catch {
      toast.error('Failed to convert')
    } finally {
      setConvertingId(null)
    }
  }

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (tab === 'done') return t.status === 'done'
      if (t.status === 'done') return false
      if (tab === 'todo') return t.type === 'todo'
      if (tab === 'checklist') return t.type === 'checklist'
      return true
    }).filter(t => {
      if (!filter.search) return true
      const q = filter.search.toLowerCase()
      return t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)
    })
  }, [tasks, tab, filter.search])

  // Grouping for pending tasks
  const overdue = useMemo(() =>
    filtered.filter(t => t.status === 'pending' && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))),
    [filtered]
  )
  const dueToday = useMemo(() =>
    filtered.filter(t => t.status === 'pending' && t.dueDate && isToday(new Date(t.dueDate))),
    [filtered]
  )
  const upcoming = useMemo(() =>
    filtered.filter(t => t.status === 'pending' && t.dueDate && !isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))),
    [filtered]
  )
  const noDate = useMemo(() =>
    filtered.filter(t => t.status === 'pending' && !t.dueDate),
    [filtered]
  )
  const done = useMemo(() =>
    filtered.filter(t => t.status === 'done'),
    [filtered]
  )

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const todoCount = tasks.filter(t => t.type === 'todo' && t.status === 'pending').length
  const checklistCount = tasks.filter(t => t.type === 'checklist' && t.status === 'pending').length
  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* ─── Header ─── */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: 'rgba(200,195,240,0.6)' }}>SpendPlan</p>
            <h1 className="text-xl font-bold" style={{ color: '#f0eeff' }}>Tasks</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-xl tap"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(240,238,255,0.8)' }}
            >
              <Search size={16} />
            </button>
            <button
              onClick={openAdd}
              className="w-9 h-9 flex items-center justify-center rounded-xl tap grad-brand"
            >
              <Plus size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Search size={14} style={{ color: 'rgba(200,195,240,0.5)' }} />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-3"
              style={{ color: '#f0eeff' }}
              placeholder="Search tasks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')} className="tap" style={{ color: 'rgba(200,195,240,0.5)' }}>
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
          {([
            { key: 'all', label: 'All', count: pendingCount },
            { key: 'todo', label: 'Todo', count: todoCount },
            { key: 'checklist', label: 'Lists', count: checklistCount },
            { key: 'done', label: 'Done', count: doneCount },
          ] as { key: TabType; label: string; count: number }[]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg tap transition-all',
                tab === key ? 'grad-brand text-white shadow' : ''
              )}
              style={tab !== key ? { color: 'rgba(200,195,240,0.7)' } : undefined}
            >
              {label}
              {count > 0 && (
                <span
                  className="text-[9px] font-bold px-1 rounded-full"
                  style={tab === key
                    ? { background: 'rgba(255,255,255,0.25)' }
                    : { background: 'rgba(124,92,252,0.3)', color: '#c4b8ff' }}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-28">

        {tab === 'done' ? (
          done.length === 0 ? (
            <EmptyState type="done" onAdd={openAdd} />
          ) : (
            <TaskGroup label="Completed" tasks={done} onEdit={openEdit} onConvert={handleConvert} />
          )
        ) : filtered.length === 0 ? (
          <EmptyState type={tab} onAdd={openAdd} />
        ) : (
          <>
            {overdue.length > 0 && (
              <TaskGroup label="Overdue" labelColor="#ff6b6b" tasks={overdue} onEdit={openEdit} onConvert={handleConvert} />
            )}
            {dueToday.length > 0 && (
              <TaskGroup label="Today" labelColor="#f59e0b" tasks={dueToday} onEdit={openEdit} onConvert={handleConvert} />
            )}
            {upcoming.length > 0 && (
              <TaskGroup label="Upcoming" tasks={upcoming} onEdit={openEdit} onConvert={handleConvert} />
            )}
            {noDate.length > 0 && (
              <TaskGroup label="No date" tasks={noDate} onEdit={openEdit} onConvert={handleConvert} />
            )}
          </>
        )}
      </div>

      {/* Task Form Modal */}
      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTask(undefined) }}
        title={editTask ? 'Edit Task' : 'New Task'}
        showClose
      >
        <TaskForm
          onClose={() => { setFormOpen(false); setEditTask(undefined) }}
          task={editTask}
        />
      </Modal>
    </div>
  )
}

// ─── Task Group ───────────────────────────────────────────────────────────────
function TaskGroup({
  label, labelColor, tasks, onEdit, onConvert,
}: {
  label: string
  labelColor?: string
  tasks: Task[]
  onEdit: (task: Task) => void
  onConvert: (task: Task) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {labelColor && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: labelColor }} />}
        <span className="text-[10px] font-bold text-3 uppercase tracking-wider" style={labelColor ? { color: labelColor } : undefined}>
          {label}
        </span>
        <span className="text-[10px] text-3">· {tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onEdit={onEdit} onConvert={onConvert} />
        ))}
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ type, onAdd }: { type: TabType | 'done'; onAdd: () => void }) {
  const config: Record<TabType | 'done', { icon: LucideIcon; title: string; desc: string }> = {
    all: { icon: ListChecks, title: 'No tasks yet', desc: 'Plan your purchases, reminders, and shopping lists here.' },
    todo: { icon: CheckCircle2, title: 'No todos', desc: 'Add a reminder, bill, or purchase intention.' },
    checklist: { icon: ShoppingCart, title: 'No checklists', desc: 'Create a shopping list or multi-item checklist.' },
    done: { icon: Trophy, title: 'Nothing done yet', desc: 'Complete tasks to see them here.' },
  }
  const { icon: Icon, title, desc } = config[type]
  return (
    <div className="card flex flex-col items-center justify-center py-12 px-6 text-center">
      <Icon size={36} className="mb-4 text-3" />
      <p className="text-lg font-bold text-1 mb-1">{title}</p>
      <p className="text-sm text-2 mb-5 max-w-[260px] leading-relaxed">{desc}</p>
      {type !== 'done' && (
        <button onClick={onAdd} className="btn btn-brand px-6 py-3 text-sm rounded-xl flex items-center gap-2">
          <Plus size={15} /> Add Task
        </button>
      )}
    </div>
  )
}
