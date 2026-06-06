import { create } from 'zustand'
import type { Task, TaskStatus, TaskType } from '@/core/types'
import { taskQueries } from '@/db/queries'
import { expenseQueries } from '@/db/queries'
import { useSyncStore } from '@/store/useSyncStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useCategoryStore } from '@/store/useCategoryStore'

// Module-level map for undo-markDone (5s grace window)
const _pendingMarkDone = new Map<string, { prevStatus: TaskStatus; timer: ReturnType<typeof setTimeout> }>()

interface TaskFilter {
  status?: TaskStatus
  type?: TaskType
  search?: string
}

interface TaskState {
  tasks: Task[]
  loading: boolean
  filter: TaskFilter

  load(): Promise<void>
  addTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>
  updateTask(id: string, updates: Partial<Task>): Promise<void>
  deleteTask(id: string): Promise<void>
  toggleItem(taskId: string, itemId: string): Promise<void>
  markDone(id: string): void
  undoMarkDone(id: string): void
  convertToExpense(taskId: string): Promise<void>
  setFilter(f: Partial<TaskFilter>): void

  getUpcoming(limit?: number): Task[]
  getOverdue(): Task[]
  getDueToday(): Task[]
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  loading: false,
  filter: {},

  load: async () => {
    set({ loading: true })
    try {
      const tasks = await taskQueries.getAll()
      set({ tasks, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  addTask: async (data) => {
    const task = await taskQueries.add(data)
    set(s => ({ tasks: [task, ...s.tasks] }))
    useSyncStore.getState().scheduleSync()
    return task
  },

  updateTask: async (id, updates) => {
    await taskQueries.update(id, updates)
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t),
    }))
    useSyncStore.getState().scheduleSync()
  },

  deleteTask: async (id) => {
    await taskQueries.delete(id)
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
    useSyncStore.getState().scheduleSync()
  },

  toggleItem: async (taskId, itemId) => {
    await taskQueries.toggleItem(taskId, itemId)
    set(s => ({
      tasks: s.tasks.map(t => {
        if (t.id !== taskId || !t.items) return t
        return {
          ...t,
          items: t.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i),
          updatedAt: Date.now(),
        }
      }),
    }))
    useSyncStore.getState().scheduleSync()
  },

  markDone: (id) => {
    const task = get().tasks.find(t => t.id === id)
    const prevStatus = task?.status ?? 'pending'
    // Optimistic update
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'done', updatedAt: Date.now() } : t),
    }))
    // Schedule actual DB write after 5s (allows undo)
    const timer = setTimeout(async () => {
      _pendingMarkDone.delete(id)
      await taskQueries.update(id, { status: 'done' })
      useSyncStore.getState().scheduleSync()
    }, 5000)
    _pendingMarkDone.set(id, { prevStatus, timer })
  },

  undoMarkDone: (id) => {
    const pending = _pendingMarkDone.get(id)
    if (!pending) return
    clearTimeout(pending.timer)
    _pendingMarkDone.delete(id)
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id ? { ...t, status: pending.prevStatus, updatedAt: Date.now() } : t
      ),
    }))
  },

  convertToExpense: async (taskId) => {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) return

    const { settings } = useSettingsStore.getState()
    const { categories } = useCategoryStore.getState()
    const currency = task.currency ?? settings.defaultCurrency

    // Calculate amount: checklist sum or task amount
    let amount = task.amount ?? 0
    if (task.type === 'checklist' && task.items?.length) {
      const itemSum = task.items.reduce((s, i) => {
        const qty = i.quantity ?? 1
        return s + (i.estimatedPrice ?? 0) * qty
      }, 0)
      if (itemSum > 0) amount = itemSum
    }

    if (amount <= 0) return

    // Fallback to first 'other/misc' category or first available category
    const fallbackCat = categories.find(c => /other|misc|general|uncategor/i.test(c.name)) ?? categories[0]
    const categoryId = task.categoryId ?? fallbackCat?.id ?? ''

    const expense = await expenseQueries.add({
      type: 'expense',
      amount,
      currency,
      categoryId: categoryId,
      tags: task.tags ?? [],
      notes: task.title,
      date: Date.now(),
      paymentMethod: settings.defaultPaymentMethod,
      isRecurring: false,
      attachments: [],
      location: task.location,
    })

    await taskQueries.update(taskId, { status: 'done', convertedExpenseId: expense.id })
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId ? { ...t, status: 'done', convertedExpenseId: expense.id, updatedAt: Date.now() } : t
      ),
    }))
    useSyncStore.getState().scheduleSync()
  },

  setFilter: (f) => set(s => ({ filter: { ...s.filter, ...f } })),

  getUpcoming: (limit = 5) => {
    const now = Date.now()
    return get().tasks
      .filter(t => t.status === 'pending' && t.dueDate && t.dueDate > now)
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, limit)
  },

  getOverdue: () => {
    const now = Date.now()
    return get().tasks.filter(t => t.status === 'pending' && t.dueDate && t.dueDate < now)
  },

  getDueToday: () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    return get().tasks.filter(t =>
      t.status === 'pending' &&
      t.dueDate !== undefined &&
      t.dueDate >= start.getTime() &&
      t.dueDate <= end.getTime()
    )
  },
}))
