import { create } from 'zustand'
import type { Category, Tag } from '@/core/types'
import { categoryQueries, tagQueries } from '@/db/queries'

interface CategoryState {
  categories: Category[]
  tags: Tag[]
  loading: boolean

  load: () => Promise<void>
  addCategory: (data: Omit<Category, 'id' | 'createdAt'>) => Promise<Category>
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addTag: (name: string, color: string) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
  getCategoryById: (id: string) => Category | undefined
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  tags: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const [categories, tags] = await Promise.all([
      categoryQueries.getAll(),
      tagQueries.getAll(),
    ])
    set({ categories, tags, loading: false })
  },

  addCategory: async (data) => {
    const cat = await categoryQueries.add(data)
    set(s => ({ categories: [...s.categories, cat] }))
    return cat
  },

  updateCategory: async (id, data) => {
    await categoryQueries.update(id, data)
    set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c) }))
  },

  deleteCategory: async (id) => {
    await categoryQueries.delete(id)
    set(s => ({ categories: s.categories.filter(c => c.id !== id) }))
  },

  addTag: async (name, color) => {
    const tag = await tagQueries.add(name, color)
    set(s => ({ tags: [...s.tags, tag] }))
    return tag
  },

  deleteTag: async (id) => {
    await tagQueries.delete(id)
    set(s => ({ tags: s.tags.filter(t => t.id !== id) }))
  },

  getCategoryById: (id) => get().categories.find(c => c.id === id),
}))
