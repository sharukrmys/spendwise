import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Search, SlidersHorizontal, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, ArrowUpDown, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ExpenseList } from './ExpenseList'
import { ExpenseForm } from './ExpenseForm'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGroupStore } from '@/store/useGroupStore'
import { formatCurrency, cn, groupExpensesToExpenses } from '@/core/utils'
import { expenseQueries } from '@/db/queries'
import { format, subMonths, addMonths } from 'date-fns'
import type { Expense } from '@/core/types'

type TabType = 'all' | 'expense' | 'income'

const monthKey = (ts: number) => format(new Date(ts), 'yyyy-MM')
const monthKeyToDate = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)

// Height (px) of the sticky month divider — day-group headers inside each month
// section are offset by this so the two sticky layers don't overlap.
const MONTH_HEADER_HEIGHT = 40

export function ExpensesPage() {
  const { filter, setFilter, dataVersion } = useExpenseStore()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()
  const { groups, groupExpenses } = useGroupStore()

  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<'expense' | 'income'>('expense')
  const [fabOpen, setFabOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [tab, setTab] = useState<TabType>('all')
  const [activeMonthKey, setActiveMonthKey] = useState(() => monthKey(Date.now()))
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [refreshing, setRefreshing] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pullStartY = useRef(0)
  const pulling = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)

  // Full history — refetched on every mutation (dataVersion), not scoped to a single month,
  // so the list can scroll seamlessly across months instead of resetting empty each month.
  // Only the initial fetch shows a spinner; later refetches swap data in place.
  useEffect(() => {
    let cancelled = false
    expenseQueries.getAll().then(exps => {
      if (cancelled) return
      setAllExpenses(exps)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [dataVersion])

  // Synthetic group expense entries (personal expenses paid within a group), across all history —
  // exclude any synthetic whose groupId+amount+date matches a personal expense already
  // linked to that group (avoids double-counting when using "Add to Group" on a personal expense)
  const allGroupSpendEntries = useMemo(() => {
    if (!settings.includeGroupSpends || !settings.myGroupName) return []
    const linkedKeys = new Set(
      allExpenses
        .filter(e => e.groupId)
        .map(e => `${e.groupId}|${e.amount}|${Math.round(e.date / 60000)}`)
    )
    return groupExpensesToExpenses(groups, groupExpenses, settings.myGroupName)
      .filter(e => !linkedKeys.has(`${e.groupId}|${e.amount}|${Math.round(e.date / 60000)}`))
  }, [settings.includeGroupSpends, settings.myGroupName, groups, groupExpenses, allExpenses])

  const allCombined = useMemo(() => [...allExpenses, ...allGroupSpendEntries], [allExpenses, allGroupSpendEntries])

  // Per-month totals — unaffected by tab/search/category filters, so the header
  // always reflects the true balance for whichever month is currently in view.
  const monthAggregates = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; count: number }>()
    for (const e of allCombined) {
      const key = monthKey(e.date)
      const agg = map.get(key) ?? { income: 0, expense: 0, count: 0 }
      if (e.type === 'income') agg.income += e.amount
      else agg.expense += e.amount
      agg.count++
      map.set(key, agg)
    }
    return map
  }, [allCombined])

  // Filtered + searched, grouped by month (newest first), items within each month
  // sorted per sortBy/sortDir — months stay in chronological order regardless of sort.
  const monthGroups = useMemo(() => {
    const filtered = allCombined.filter(e => {
      if (tab === 'expense' && e.type !== 'expense') return false
      if (tab === 'income' && e.type !== 'income') return false
      if (filter.categoryId && e.categoryId !== filter.categoryId) return false
      if (filter.paymentMethod && e.paymentMethod !== filter.paymentMethod) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!(e.notes?.toLowerCase().includes(q) || e.amount.toString().includes(q))) return false
      }
      return true
    })
    const byMonth = new Map<string, Expense[]>()
    for (const e of filtered) {
      const key = monthKey(e.date)
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(e)
    }
    const mult = sortDir === 'desc' ? -1 : 1
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) =>
        [key, [...items].sort((a, b) => sortBy === 'date' ? mult * (a.date - b.date) : mult * (a.amount - b.amount))] as const
      )
  }, [allCombined, filter.categoryId, filter.paymentMethod, tab, sortBy, sortDir, searchQuery])

  // Scrollspy — whichever month section's top has scrolled up to (or past) the sticky
  // header band is the "active" one driving the header above. Computed directly from
  // geometry on every scroll frame rather than via IntersectionObserver: a razor-thin
  // observer margin can miss a section entirely during a large/fast jump (a flung scroll,
  // or the smooth `scrollIntoView` the prev/next arrows trigger) since IO only samples
  // discrete frames — a fast-moving target can cross a thin band between two samples.
  useEffect(() => {
    const root = listRef.current
    if (!root || monthGroups.length === 0) return
    let ticking = false
    let scrollingTimer: ReturnType<typeof setTimeout>
    const updateActiveMonth = () => {
      ticking = false
      setScrolled(root.scrollTop > 4)
      const rootTop = root.getBoundingClientRect().top
      let current: string | null = null
      for (const [key] of monthGroups) {
        const el = monthRefs.current[key]
        if (!el) continue
        const top = el.getBoundingClientRect().top - rootTop
        if (top <= MONTH_HEADER_HEIGHT + 1) current = key
        else break
      }
      if (current) setActiveMonthKey(current)
    }
    const onScroll = () => {
      setIsScrolling(true)
      clearTimeout(scrollingTimer)
      scrollingTimer = setTimeout(() => setIsScrolling(false), 400)
      if (ticking) return
      ticking = true
      requestAnimationFrame(updateActiveMonth)
    }
    updateActiveMonth()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      clearTimeout(scrollingTimer)
    }
  }, [monthGroups])

  const sortLabel = sortBy === 'date'
    ? (sortDir === 'desc' ? 'Newest' : 'Oldest')
    : (sortDir === 'desc' ? 'Highest' : 'Lowest')

  const cycleSort = () => {
    if (sortBy === 'date' && sortDir === 'desc') setSortDir('asc')
    else if (sortBy === 'date' && sortDir === 'asc') { setSortBy('amount'); setSortDir('desc') }
    else if (sortBy === 'amount' && sortDir === 'desc') setSortDir('asc')
    else { setSortBy('date'); setSortDir('desc') }
  }

  const goToMonth = (key: string) => {
    const el = monthRefs.current[key]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else setActiveMonthKey(key)
  }

  const activeAgg = monthAggregates.get(activeMonthKey) ?? { income: 0, expense: 0, count: 0 }
  const balance = activeAgg.income - activeAgg.expense
  const isCurrentMonth = activeMonthKey >= format(new Date(), 'yyyy-MM')
  const fmt = (v: number) => formatCurrency(v, settings.defaultCurrency, settings.showCents)

  const PULL_THRESHOLD = 72

  const handleTouchStart = (e: React.TouchEvent) => {
    if (listRef.current && listRef.current.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY
      pulling.current = true
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current) return
    const delta = Math.max(0, e.touches[0].clientY - pullStartY.current)
    setPullDistance(Math.min(delta, PULL_THRESHOLD * 1.5))
  }

  const handleTouchEnd = async () => {
    if (!pulling.current) return
    pulling.current = false
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true)
      setPullDistance(0)
      setAllExpenses(await expenseQueries.getAll())
      setRefreshing(false)
    } else {
      setPullDistance(0)
    }
  }

  const openAdd = (type: 'expense' | 'income') => { setAddType(type); setAddOpen(true) }

  return (
    <div className="flex flex-col h-full bg-base">
      {/* ─── Header ─── slim month-nav bar always visible; balance/income-expense/search
          collapse away while scrolling so the list gets the vertical space instead,
          and expand back the moment you're back at the top. ──────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-3">
        {/* Month nav */}
        <div className={cn('flex items-center justify-between transition-all duration-300', scrolled ? 'mb-0' : 'mb-5')}>
          <button aria-label="Previous month" onClick={() => goToMonth(format(subMonths(monthKeyToDate(activeMonthKey), 1), 'yyyy-MM'))} className="w-9 h-9 flex items-center justify-center rounded-xl tap shrink-0" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <ChevronLeft size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
          </button>
          <div className="text-center flex items-baseline gap-2">
            <p className="text-base font-bold" style={{ color: '#f0eeff' }}>{format(monthKeyToDate(activeMonthKey), 'MMMM yyyy')}</p>
            {scrolled ? (
              <p className={cn('text-sm font-bold', balance >= 0 ? 'text-income' : 'text-expense')}>
                {balance >= 0 ? '+' : ''}{fmt(balance)}
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'rgba(200,195,240,0.6)' }}>{activeAgg.count} transaction{activeAgg.count !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button aria-label="Next month" onClick={() => goToMonth(format(addMonths(monthKeyToDate(activeMonthKey), 1), 'yyyy-MM'))} disabled={isCurrentMonth} className="w-9 h-9 flex items-center justify-center rounded-xl tap disabled:opacity-30 shrink-0" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <ChevronRight size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
          </button>
        </div>

        {/* Collapsible: balance, income/expense, search */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: scrolled ? '0fr' : '1fr',
            transition: 'grid-template-rows 280ms ease',
          }}
        >
          <div className="overflow-hidden">
            {/* Balance + income/expense */}
            <div className="text-center mb-5 pt-1">
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
                  <p className="text-sm font-bold truncate" style={{ color: '#f0eeff' }}>{fmt(activeAgg.income)}</p>
                </div>
              </button>
              <button onClick={() => openAdd('expense')} className="flex items-center gap-2.5 rounded-2xl p-3 tap" style={{ background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.25)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,107,0.25)' }}>
                  <TrendingDown size={15} className="text-expense" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[10px] font-semibold text-expense uppercase tracking-wide">Expenses</p>
                  <p className="text-sm font-bold truncate" style={{ color: '#f0eeff' }}>{fmt(activeAgg.expense)}</p>
                </div>
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(200,195,240,0.5)' }} />
              <input
                className="pl-10 pr-10 py-3 text-sm w-full rounded-[0.875rem] outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)', color: '#f0eeff', fontSize: '1rem' }}
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
      <div
        ref={listRef}
        className="flex-1 min-h-0 bg-base overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            className="flex items-center justify-center overflow-hidden transition-all duration-200"
            style={{ height: refreshing ? 48 : Math.min(pullDistance, PULL_THRESHOLD) * 0.67 }}
          >
            <RefreshCw
              size={18}
              className={refreshing ? 'animate-spin text-brand' : 'text-3'}
              style={{ transform: `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)`, transition: refreshing ? undefined : 'none' }}
            />
          </div>
        )}
        {loading ? null : monthGroups.length === 0 && allCombined.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <Search size={32} className="mb-3 text-3" />
            <p className="text-base font-semibold text-1 mb-1">No results</p>
            <p className="text-sm text-2 mb-4">Try adjusting your filters or search term.</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setFilter({ categoryId: undefined, paymentMethod: undefined })
              }}
              className="text-sm font-semibold text-brand tap px-4 py-2 rounded-xl"
              style={{ background: 'rgba(124,92,252,0.12)' }}
            >
              Clear filters
            </button>
          </div>
        ) : monthGroups.length === 0 ? (
          <ExpenseList expenses={[]} loading={loading} onAdd={() => setAddOpen(true)} />
        ) : (
          monthGroups.map(([key, items]) => (
            // The scrollspy ref/data attribute lives on this plain (non-sticky) wrapper,
            // not the sticky header below — scrollIntoView and IntersectionObserver both
            // get unreliable geometry from a `position: sticky` element once it's scrolled
            // past, since its rect can reflect a stale "stuck" offset rather than its true
            // flow position.
            <div key={key} ref={el => { monthRefs.current[key] = el }} data-month-key={key}>
              <div
                className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-base border-b border-ui"
                style={{ height: MONTH_HEADER_HEIGHT }}
              >
                <span className="text-xs font-bold text-1 uppercase tracking-wide">{format(monthKeyToDate(key), 'MMMM yyyy')}</span>
                <span className="text-xs text-3">{items.length} txn{items.length !== 1 ? 's' : ''}</span>
              </div>
              <ExpenseList expenses={items} onAdd={() => setAddOpen(true)} stickyOffset={MONTH_HEADER_HEIGHT} />
            </div>
          ))
        )}
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
            style={{
              bottom: '5.5rem',
              right: '1.25rem',
              zIndex: 50,
              transform: `${fabOpen ? 'rotate(45deg) ' : 'rotate(0deg) '}scale(${isScrolling && !fabOpen ? 0.85 : 1})`,
              opacity: isScrolling && !fabOpen ? 0 : 1,
              pointerEvents: isScrolling && !fabOpen ? 'none' : 'auto',
              transition: 'transform 0.2s, opacity 0.2s',
            }}
          >
            <Plus size={24} className="text-white" />
          </button>
        </>,
        document.body
      )}

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
        <ExpenseForm onClose={() => setAddOpen(false)} defaultType={addType} />
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
