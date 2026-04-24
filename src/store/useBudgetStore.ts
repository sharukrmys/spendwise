import { create } from 'zustand'
import type { Budget } from '@/core/types'
import { budgetQueries } from '@/db/queries'

interface BudgetState {
  budgets: Budget[]
  load: () => Promise<void>
  addBudget: (data: Omit<Budget, 'id' | 'createdAt'>) => Promise<Budget>
  updateBudget: (id: string, data: Partial<Budget>) => Promise<void>
  deleteBudget: (id: string) => Promise<void>
}

export const useBudgetStore = create<BudgetState>((set) => ({
  budgets: [],

  load: async () => {
    const budgets = await budgetQueries.getAll()
    set({ budgets })
  },

  addBudget: async (data) => {
    const budget = await budgetQueries.add(data)
    set(s => ({ budgets: [...s.budgets, budget] }))
    return budget
  },

  updateBudget: async (id, data) => {
    await budgetQueries.update(id, data)
    set(s => ({ budgets: s.budgets.map(b => b.id === id ? { ...b, ...data } : b) }))
  },

  deleteBudget: async (id) => {
    await budgetQueries.delete(id)
    set(s => ({ budgets: s.budgets.filter(b => b.id !== id) }))
  },
}))
