import { create } from 'zustand'
import type { Expense } from '@/core/types'
import { expenseQueries } from '@/db/queries'
import { getMonthRange } from '@/core/utils'
import { useSyncStore } from '@/store/useSyncStore'

// Module-level map for undo-delete (not in Zustand state — no serialization)
const _pendingDeletes = new Map<string, { expense: Expense; timer: ReturnType<typeof setTimeout> }>()

interface ExpenseState {
  expenses: Expense[]
  loading: boolean
  error: string | null
  // Bumped on every mutation (including the deferred delete finalize, which
  // doesn't otherwise touch `expenses`) so screens that cache a wider,
  // multi-month dataset alongside the month-scoped `expenses` know when to refetch.
  dataVersion: number
  filter: {
    startDate: number
    endDate: number
    categoryId?: string
    paymentMethod?: string
    search?: string
    tags?: string[]
  }

  // Actions
  load: () => Promise<void>
  loadByRange: (start: number, end: number) => Promise<void>
  addExpense: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense>
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>
  deleteExpense: (id: string) => void
  undoDeleteExpense: (id: string) => void
  setFilter: (filter: Partial<ExpenseState['filter']>) => void
  resetFilter: () => void
}

const defaultFilter = () => {
  const { start, end } = getMonthRange()
  return { startDate: start, endDate: end }
}

export const useExpenseStore = create<ExpenseState>()((set, get) => ({
    expenses: [],
    loading: false,
    error: null,
    dataVersion: 0,
    filter: defaultFilter(),

    load: async () => {
      set({ loading: true, error: null })
      try {
        const { filter } = get()
        const expenses = await expenseQueries.getByRange(filter.startDate, filter.endDate)
        set({ expenses, loading: false })
      } catch (e) {
        set({ error: (e as Error).message, loading: false })
      }
    },

    loadByRange: async (start, end) => {
      set({ loading: true, error: null })
      try {
        const expenses = await expenseQueries.getByRange(start, end)
        set({ expenses, loading: false })
      } catch (e) {
        set({ error: (e as Error).message, loading: false })
      }
    },

    addExpense: async (data) => {
      const expense = await expenseQueries.add(data)
      set(s => ({ expenses: [expense, ...s.expenses], dataVersion: s.dataVersion + 1 }))
      useSyncStore.getState().scheduleSync()
      return expense
    },

    updateExpense: async (id, data) => {
      await expenseQueries.update(id, data)
      set(s => ({
        expenses: s.expenses.map(e => e.id === id ? { ...e, ...data, updatedAt: Date.now() } : e),
        dataVersion: s.dataVersion + 1,
      }))
      useSyncStore.getState().scheduleSync()
    },

    deleteExpense: (id) => {
      const expense = get().expenses.find(e => e.id === id)
      if (!expense) return
      // Optimistic remove from UI immediately
      set(s => ({ expenses: s.expenses.filter(e => e.id !== id), dataVersion: s.dataVersion + 1 }))
      // Schedule actual DB delete after 5s (allows undo)
      const timer = setTimeout(async () => {
        _pendingDeletes.delete(id)
        await expenseQueries.delete(id)
        // `expenses` was already updated optimistically above, so bump dataVersion
        // alone to tell wider-range caches (which still had this row until now) to refetch
        set(s => ({ dataVersion: s.dataVersion + 1 }))
        useSyncStore.getState().scheduleSync()
      }, 5000)
      _pendingDeletes.set(id, { expense, timer })
    },

    undoDeleteExpense: (id) => {
      const pending = _pendingDeletes.get(id)
      if (!pending) return
      clearTimeout(pending.timer)
      _pendingDeletes.delete(id)
      set(s => ({
        expenses: [...s.expenses, pending.expense].sort((a, b) => b.date - a.date),
        dataVersion: s.dataVersion + 1,
      }))
    },

    setFilter: (filter) => set(s => ({ filter: { ...s.filter, ...filter } })),
    resetFilter: () => set({ filter: defaultFilter() }),
  })
)

