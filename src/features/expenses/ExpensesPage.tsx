import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Search, SlidersHorizontal, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, ArrowUpDown } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ExpenseList } from './ExpenseList'
import { ExpenseForm } from './ExpenseForm'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { formatCurrency, getMonthRange, cn } from '@/core/utils'
import { format, subMonths, addMonths } from 'date-fns'

type TabType = 'all' | 'expense' | 'income'

export function ExpensesPage() {
  const { load, loading, filter, setFilter } = useExpenseStore()
  const rawExpenses = useExpenseStore(s => s.expenses)
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()

  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<'expense' | 'income'>('expense')
  const [fabOpen, setFabOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('all')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    const range = getMonthRange(currentDate)
    setFilter({ startDate: range.start, endDate: range.end })
  }, [currentDate])

  useEffect(() => { load() }, [filter])

  useEffect(() => {
    setFilter({ search: searchQuery || undefined })
  }, [searchQuery])

  const expenses = useMemo(() => {
    const filtered = rawExpenses.filter(e => {
      if (tab === 'expense' && e.type !== 'expense') return false
      if (tab === 'income' && e.type !== 'income') return false
      if (filter.categoryId && e.categoryId !== filter.categoryId) return false
      if (filter.paymentMethod && e.paymentMethod !== filter.paymentMethod) return false
      if (filter.search) {
        const q = filter.search.toLowerCase()
        if (!(e.notes?.toLowerCase().includes(q) || e.amount.toString().includes(q))) return false
      }
      return true
    })
    const mult = sortDir === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) =>
      sortBy === 'date' ? mult * (a.date - b.date) : mult * (a.amount - b.amount)
    )
  }, [rawExpenses, filter, tab, sortBy, sortDir])

  const sortLabel = sortBy === 'date'
    ? (sortDir === 'desc' ? 'Newest' : 'Oldest')
    : (sortDir === 'desc' ? 'Highest' : 'Lowest')

  const cycleSort = () => {
    if (sortBy === 'date' && sortDir === 'desc') setSortDir('asc')
    else if (sortBy === 'date' && sortDir === 'asc') { setSortBy('amount'); setSortDir('desc') }
    else if (sortBy === 'amount' && sortDir === 'desc') setSortDir('asc')
    else { setSortBy('date'); setSortDir('desc') }
  }

  const incomeTotal = useMemo(() => rawExpenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0), [rawExpenses])
  const expenseTotal = useMemo(() => rawExpenses.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0), [rawExpenses])
  const balance = incomeTotal - expenseTotal

  const isCurrentMonth = format(currentDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  const fmt = (v: number) => formatCurrency(v, settings.defaultCurrency, settings.showCents)

  const openAdd = (type: 'expense' | 'income') => { setAddType(type); setAddOpen(true) }

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* ─── Header ───────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-4">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setCurrentDate(d => subMonths(d, 1))} className="w-9 h-9 flex items-center justify-center rounded-xl tap" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <ChevronLeft size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
          </button>
          <div className="text-center">
            <p className="text-base font-bold" style={{ color: '#f0eeff' }}>{format(currentDate, 'MMMM yyyy')}</p>
            <p className="text-xs" style={{ color: 'rgba(200,195,240,0.6)' }}>{rawExpenses.length} transactions</p>
          </div>
          <button onClick={() => setCurrentDate(d => addMonths(d, 1))} disabled={isCurrentMonth} className="w-9 h-9 flex items-center justify-center rounded-xl tap disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <ChevronRight size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
          </button>
        </div>

        {/* Balance + income/expense */}
        <div className="text-center mb-5">
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgba(200,195,240,0.6)' }}>Balance</p>
          <p className={cn('text-4xl font-bold', balance >= 0 ? 'text-income' : 'text-expense')}>
            {balance >= 0 ? '+' : ''}{fmt(balance)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button onClick={() => openAdd('income')} className="flex items-center gap-2.5 rounded-2xl p-3 tap" style={{ background: 'rgba(0,200,150,0.15)', border: '1px solid rgba(0,200,150,0.25)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,200,150,0.25)' }}>
              <TrendingUp size={15} className="text-income" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-semibold text-income uppercase tracking-wide">Income</p>
              <p className="text-sm font-bold truncate" style={{ color: '#f0eeff' }}>{fmt(incomeTotal)}</p>
            </div>
          </button>
          <button onClick={() => openAdd('expense')} className="flex items-center gap-2.5 rounded-2xl p-3 tap" style={{ background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.25)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,107,0.25)' }}>
              <TrendingDown size={15} className="text-expense" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-semibold text-expense uppercase tracking-wide">Expenses</p>
              <p className="text-sm font-bold truncate" style={{ color: '#f0eeff' }}>{fmt(expenseTotal)}</p>
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(200,195,240,0.5)' }} />
          <input
            className="pl-10 pr-10 py-3 text-sm w-full rounded-[0.875rem] outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)', color: '#f0eeff', fontSize: '0.9375rem' }}
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 tap">
              <X size={15} style={{ color: 'rgba(200,195,240,0.5)' }} />
            </button>
          ) : (
            <button onClick={() => setFilterOpen(true)} className="absolute right-3 top-1/2 -translate-y-1/2 tap">
              <SlidersHorizontal size={15} style={{ color: 'rgba(200,195,240,0.5)' }} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Tabs + Sort ──────────────────────── */}
      <div className="flex gap-1 px-4 py-2.5 border-b border-ui items-center" style={{ background: 'var(--bg-card)' }}>
        {(['all', 'expense', 'income'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-xs font-semibold rounded-xl tap transition-all capitalize',
              tab === t
                ? t === 'income' ? 'bg-income/15 text-income' : t === 'expense' ? 'bg-expense/15 text-expense' : 'grad-brand text-white'
                : 'text-2 hover:text-1'
            )}
          >
            {t === 'all' ? 'All' : t === 'income' ? '↑ Income' : '↓ Expense'}
          </button>
        ))}
        <button
          onClick={cycleSort}
          className="ml-1 flex items-center gap-1 text-xs text-3 tap px-2.5 py-2 rounded-xl bg-card2 shrink-0 hover:text-1 transition-colors"
        >
          <ArrowUpDown size={11} />{sortLabel}
        </button>
      </div>

      {/* ─── Active filters ───────────────────── */}
      {(filter.categoryId || filter.paymentMethod) && (
        <div className="flex gap-2 px-4 py-2 flex-wrap">
          {filter.categoryId && (() => {
            const cat = categories.find(c => c.id === filter.categoryId)
            return cat ? (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--brand)' }}>
                {cat.icon} {cat.name}
                <button onClick={() => setFilter({ categoryId: undefined })} className="tap"><X size={11} /></button>
              </span>
            ) : null
          })()}
          {filter.paymentMethod && (
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--brand)' }}>
              {filter.paymentMethod}
              <button onClick={() => setFilter({ paymentMethod: undefined })} className="tap"><X size={11} /></button>
            </span>
          )}
        </div>
      )}

      {/* ─── List ─────────────────────────────── */}
      <div className="flex-1 bg-base">
        <ExpenseList expenses={expenses} loading={loading} onAdd={() => setAddOpen(true)} />
      </div>

      {/* FAB — portalled to body so position:fixed works on iOS */}
      {createPortal(
        <>
          {fabOpen && (
            <div
              className="fixed inset-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 48 }}
              onClick={() => setFabOpen(false)}
            />
          )}

          {fabOpen && (
            <div className="fixed flex flex-col items-end gap-3" style={{ bottom: '8rem', right: '1.25rem', zIndex: 49 }}>
              <button onClick={() => { setFabOpen(false); openAdd('income') }} className="flex items-center gap-3 tap">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full border border-ui text-1" style={{ background: 'var(--bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>Add Income</span>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#00c896,#00a77a)', boxShadow: '0 6px 20px rgba(0,200,150,0.5)' }}>
                  <ArrowUpCircle size={22} className="text-white" />
                </div>
              </button>
              <button onClick={() => { setFabOpen(false); openAdd('expense') }} className="flex items-center gap-3 tap">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full border border-ui text-1" style={{ background: 'var(--bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>Add Expense</span>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#ff6b6b,#ee3c3c)', boxShadow: '0 6px 20px rgba(255,107,107,0.5)' }}>
                  <ArrowDownCircle size={22} className="text-white" />
                </div>
              </button>
            </div>
          )}

          <button
            onClick={() => setFabOpen(v => !v)}
            className="fab w-14 h-14"
            style={{ bottom: '5.5rem', right: '1.25rem', zIndex: 50, transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <Plus size={24} className="text-white" />
          </button>
        </>,
        document.body
      )}

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
        <ExpenseForm onClose={() => { setAddOpen(false); load() }} defaultType={addType} />
      </Modal>

      {/* Filter modal */}
      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter" size="sm">
        <div className="p-4 flex flex-col gap-4 pb-6">
          <div>
            <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">Category</p>
            <div className="grid grid-cols-3 gap-2">
              {categories.filter(c => !c.parentId).map(c => (
                <button
                  key={c.id}
                  onClick={() => setFilter({ categoryId: filter.categoryId === c.id ? undefined : c.id })}
                  className={cn(
                    'p-2.5 rounded-xl text-center text-xs font-medium tap transition-all',
                    filter.categoryId === c.id ? 'ring-1' : 'bg-card2'
                  )}
                  style={filter.categoryId === c.id ? { background: `${c.color}20`, color: c.color, outlineColor: c.color } : {}}
                >
                  <span className="block text-xl mb-1">{c.icon}</span>
                  <span className="truncate block text-2">{c.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-brand w-full py-3.5 text-sm" onClick={() => setFilterOpen(false)}>Apply Filter</button>
        </div>
      </Modal>
    </div>
  )
}
