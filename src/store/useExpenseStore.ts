import { create } from 'zustand'
import type { Expense } from '@/core/types'
import { expenseQueries } from '@/db/queries'
import { getMonthRange } from '@/core/utils'
import { useSyncStore } from '@/store/useSyncStore'

interface ExpenseState {
  expenses: Expense[]
  loading: boolean
  error: string | null
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
  deleteExpense: (id: string) => Promise<void>
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
      set(s => ({ expenses: [expense, ...s.expenses] }))
      useSyncStore.getState().scheduleSync()
      return expense
    },

    updateExpense: async (id, data) => {
      await expenseQueries.update(id, data)
      set(s => ({
        expenses: s.expenses.map(e => e.id === id ? { ...e, ...data, updatedAt: Date.now() } : e),
      }))
      useSyncStore.getState().scheduleSync()
    },

    deleteExpense: async (id) => {
      await expenseQueries.delete(id)
      set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
      useSyncStore.getState().scheduleSync()
    },

    setFilter: (filter) => set(s => ({ filter: { ...s.filter, ...filter } })),
    resetFilter: () => set({ filter: defaultFilter() }),
  })
)

