import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, ArrowRight } from 'lucide-react'
import Fuse from 'fuse.js'
import { useNavigate } from 'react-router-dom'
import { useTaskStore } from '@/store/useTaskStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { expenseQueries } from '@/db/queries'
import { formatCurrency, formatDate } from '@/core/utils'
import type { Expense, Task } from '@/core/types'

type SearchResult =
  | { kind: 'expense'; item: Expense; matches: string }
  | { kind: 'task';    item: Task;    matches: string }

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const tasks = useTaskStore(s => s.tasks)
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()

  useEffect(() => {
    if (open) {
      expenseQueries.getAll().then(setAllExpenses)
      setTimeout(() => inputRef.current?.focus(), 60)
    } else {
      setQuery('')
    }
  }, [open])

  const expenseFuse = useMemo(() => new Fuse(allExpenses, {
    keys: ['notes', 'location'],
    threshold: 0.35,
    includeScore: true,
  }), [allExpenses])

  const taskFuse = useMemo(() => new Fuse(tasks, {
    keys: ['title', 'notes', 'location'],
    threshold: 0.35,
    includeScore: true,
  }), [tasks])

  const results = useMemo((): SearchResult[] => {
    if (query.trim().length < 2) return []
    const expResults: SearchResult[] = expenseFuse.search(query).slice(0, 5).map(r => ({
      kind: 'expense',
      item: r.item,
      matches: r.item.notes || '',
    }))
    const taskResults: SearchResult[] = taskFuse.search(query).slice(0, 5).map(r => ({
      kind: 'task',
      item: r.item,
      matches: r.item.title,
    }))
    return [...expResults, ...taskResults].slice(0, 10)
  }, [query, expenseFuse, taskFuse])

  const fmt = (v: number, cur: string) => formatCurrency(v, cur, settings.showCents)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(10,9,20,0.92)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Search bar */}
      <div className="px-4 pt-safe pb-0 mt-3">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1.5px solid var(--brand)' }}
        >
          <Search size={18} style={{ color: 'var(--brand)' }} className="shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search expenses, tasks…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
          {query ? (
            <button onClick={() => setQuery('')} className="tap">
              <X size={16} style={{ color: 'var(--text-3)' }} />
            </button>
          ) : (
            <button onClick={onClose} className="tap">
              <X size={16} style={{ color: 'var(--text-3)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {query.trim().length < 2 && (
          <p className="text-center text-sm mt-8" style={{ color: 'var(--text-3)' }}>
            Type at least 2 characters to search
          </p>
        )}

        {query.trim().length >= 2 && results.length === 0 && (
          <p className="text-center text-sm mt-8" style={{ color: 'var(--text-3)' }}>
            No results for "{query}"
          </p>
        )}

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((r, i) => {
              if (r.kind === 'expense') {
                const cat = categories.find(c => c.id === r.item.categoryId)
                const isIncome = r.item.type === 'income'
                return (
                  <button
                    key={`e-${r.item.id}-${i}`}
                    onClick={() => { navigate('/expenses'); onClose() }}
                    className="flex items-center gap-3 p-3 rounded-2xl tap text-left"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ background: isIncome ? 'rgba(0,200,150,0.15)' : `${cat?.color ?? '#7c5cfc'}18` }}
                    >
                      {isIncome ? '💰' : (cat?.icon ?? '📦')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-1 truncate">
                        {r.item.notes || cat?.name || (isIncome ? 'Income' : 'Expense')}
                      </p>
                      <p className="text-xs text-3">{formatDate(r.item.date, 'MMM d, yyyy')}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isIncome ? 'text-income' : 'text-expense'}`}>
                      {isIncome ? '+' : '-'}{fmt(r.item.amount, r.item.currency)}
                    </span>
                  </button>
                )
              }
              // task
              return (
                <button
                  key={`t-${r.item.id}-${i}`}
                  onClick={() => { navigate('/tasks'); onClose() }}
                  className="flex items-center gap-3 p-3 rounded-2xl tap text-left"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: 'rgba(124,92,252,0.12)' }}
                  >
                    {r.item.type === 'checklist' ? '🛒' : '✅'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-1 truncate">{r.item.title}</p>
                    <p className="text-xs text-3">
                      {r.item.status === 'done' ? 'Completed' : r.item.dueDate ? formatDate(r.item.dueDate, 'MMM d') : 'No date'}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-3 shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
