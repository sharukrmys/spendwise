import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, ShieldCheck, HardDrive, ChevronDown, RefreshCw, CloudOff, Settings, Square, ShoppingCart, ListTodo, Bell } from 'lucide-react'
import logoSrc from '@/assets/SR.png'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { ExpenseItem } from '@/features/expenses/ExpenseItem'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useSyncStore } from '@/store/useSyncStore'
import { useTaskStore } from '@/store/useTaskStore'
import { formatCurrency, getMonthRange, buildTrendData, summarizeExpenses, cn } from '@/core/utils'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { expenseQueries } from '@/db/queries'
import type { Expense, Task } from '@/core/types'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  const { expenses, load, filter, setFilter } = useExpenseStore()
  const { categories } = useCategoryStore()
  const { budgets } = useBudgetStore()
  const { settings } = useSettingsStore()
  const { user: syncUser, enabled: syncEnabled, status: syncStatus, smartSync } = useSyncStore()
  const allTasks = useTaskStore(s => s.tasks)
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>([])

  useEffect(() => {
    const range = getMonthRange()
    setFilter({ startDate: range.start, endDate: range.end })
    useTaskStore.getState().load()
  }, [])

  useEffect(() => { load() }, [filter])

  useEffect(() => {
    expenseQueries.getAll().then(setAllExpenses)
    expenseQueries.getRecurring().then(setRecurringExpenses)
  }, [expenses])

  const upcomingTasks = useMemo(() => {
    const now = Date.now()
    return allTasks
      .filter(t => t.status === 'pending' && t.dueDate && t.dueDate > now)
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 3)
  }, [allTasks])

  const todayTasks = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    return allTasks.filter(t =>
      t.status === 'pending' &&
      t.dueDate !== undefined &&
      t.dueDate >= start.getTime() &&
      t.dueDate <= end.getTime()
    )
  }, [allTasks])

  const summary = useMemo(() => summarizeExpenses(expenses), [expenses])
  const trendData = useMemo(() => buildTrendData(allExpenses, 6), [allExpenses])

  // Top categories (for list below)
  const categoryChartData = useMemo(() =>
    Object.entries(summary.byCategory)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId)
        return { name: cat?.name ?? 'Other', value: amount, color: cat?.color ?? '#7c5cfc', icon: cat?.icon }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
    [summary.byCategory, categories]
  )

  // Budget
  const overallBudget = budgets.find(b => !b.categoryId && b.period === 'monthly')
  const budgetPct = overallBudget ? Math.min((summary.total / overallBudget.amount) * 100, 100) : 0

  // Recent 6 expenses (excluding income)
  const recent = useMemo(() =>
    [...expenses].filter(e => e.type !== 'income').sort((a, b) => b.date - a.date).slice(0, 6),
    [expenses]
  )

  const fmt = (v: number) => formatCurrency(v, settings.defaultCurrency, settings.showCents)

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* ─── Hero Header ─────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 70%)' }}>
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #7c5cfc, transparent 70%)' }} />
        <div className="absolute top-8 -left-8 w-32 h-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)' }} />

        <div className="relative px-5 pb-5 pt-safe">
          {/* ── App bar: logo · sync · avatar ── */}
          <div className="flex items-center justify-between mb-4">
            <img src={logoSrc} alt="SR" className="h-7 w-auto" />
            <div className="flex items-center gap-1">
              {/* Sync — always rendered */}
              <button
                onClick={() => syncEnabled ? smartSync(load) : navigate('/settings')}
                disabled={syncStatus === 'syncing'}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl tap"
                style={{ color: syncEnabled ? 'rgba(240,238,255,0.85)' : 'rgba(200,195,240,0.35)' }}
                aria-label={syncEnabled ? 'Sync now' : 'Connect Drive'}
              >
                {syncEnabled
                  ? <RefreshCw size={17} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                  : <CloudOff size={17} />}
                {syncEnabled && (
                  <span
                    className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: syncStatus === 'syncing' ? '#7c5cfc'
                        : syncStatus === 'success' ? '#00c896'
                        : syncStatus === 'error' ? '#ff6b6b'
                        : 'rgba(255,255,255,0.2)',
                    }}
                  />
                )}
              </button>

              {/* Avatar with gear badge → Settings */}
              {syncUser ? (
                <button
                  onClick={() => navigate('/settings')}
                  className="relative w-10 h-10 flex items-center justify-center tap"
                  aria-label="Settings"
                >
                  {syncUser.picture ? (
                    <img
                      src={syncUser.picture}
                      alt={syncUser.name}
                      className="w-9 h-9 rounded-full"
                      style={{ border: '2px solid rgba(124,92,252,0.6)' }}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#7c5cfc,#a855f7)', border: '2px solid rgba(124,92,252,0.6)' }}>
                      {syncUser.name[0]}
                    </div>
                  )}
                  {/* Gear badge — settings affordance */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#1a1535', border: '1.5px solid rgba(124,92,252,0.5)' }}>
                    <Settings size={8} style={{ color: '#7c5cfc' }} />
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/settings')}
                  className="w-9 h-9 flex items-center justify-center rounded-xl tap"
                  style={{ color: 'rgba(240,238,255,0.75)' }}
                  aria-label="Settings"
                >
                  <Settings size={17} />
                </button>
              )}
            </div>
          </div>

          {/* Greeting */}
          <div className="mb-5">
            <p className="text-xs mb-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>{format(new Date(), 'EEEE, MMM d')}</p>
            <h1 className="text-xl font-bold leading-tight" style={{ color: '#f0eeff' }}>
              {syncUser ? `${getGreeting()}, ${syncUser.name.split(' ')[0]} 👋 ` : `${getGreeting()} 👋 `}
              <span>Welcome back</span>
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(200,195,240,0.45)' }}>Your Monthly Expense Summary</p>
          </div>

          {/* Budget ring (left) + spending info (right) */}
          <div className="flex items-center gap-5">
            {/* Category donut */}
            <div className="relative shrink-0 w-[90px] h-[90px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData.length > 0 ? categoryChartData : [{ name: 'Empty', value: 1, color: '#2d2650' }]}
                    cx="50%" cy="50%"
                    innerRadius={28} outerRadius={42}
                    paddingAngle={categoryChartData.length > 0 ? 4 : 0}
                    dataKey="value" strokeWidth={0}
                  >
                    {(categoryChartData.length > 0 ? categoryChartData : [{ color: '#2d2650' }]).map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {overallBudget ? (
                  <>
                    <p className="text-sm font-bold leading-none" style={{ color: budgetPct > 85 ? '#ff6b6b' : '#00c896' }}>
                      {budgetPct.toFixed(0)}%
                    </p>
                    <p className="text-[8px] leading-none mt-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>of Budget</p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold leading-none" style={{ color: '#f0eeff' }}>{summary.count}</p>
                    <p className="text-[8px] leading-none mt-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>txns</p>
                  </>
                )}
              </div>
            </div>

            {/* Right: amount + category chips */}
            <div className="flex-1 min-w-0 pl-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>
                Total Spent · {format(new Date(), 'MMMM yyyy')}
              </p>
              <p className="text-[28px] font-bold leading-tight mb-2.5" style={{ color: '#f0eeff' }}>
                {fmt(summary.total)}
              </p>

              {/* Category chips — horizontal scroll */}
              {categoryChartData.length > 0 ? (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {categoryChartData.slice(0, 4).map(cat => (
                    <div
                      key={cat.name}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
                      style={{ background: `${cat.color}20`, border: `1px solid ${cat.color}35` }}
                    >
                      <span className="text-xs leading-none">{cat.icon}</span>
                      <span className="text-[10px] font-semibold" style={{ color: 'rgba(200,195,240,0.8)' }}>{cat.name}</span>
                      <span className="text-[10px] font-bold" style={{ color: cat.color }}>{fmt(cat.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px]" style={{ color: 'rgba(200,195,240,0.3)' }}>No transactions yet</p>
              )}

              <button
                onClick={() => navigate('/expenses')}
                className="flex items-center gap-1 text-[11px] font-semibold tap mt-2"
                style={{ color: '#7c5cfc' }}
              >
                View all <ArrowRight size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Privacy & Security Banner — collapsible */}
        <PrivacyBanner />

        {/* Subscription reminder strip */}
        {recurringExpenses.length > 0 && (
          <SubscriptionStrip expenses={recurringExpenses} categories={categories} fmt={fmt} />
        )}

        {/* Today's Tasks strip */}
        {todayTasks.length > 0 && (
          <TodayTasksStrip tasks={todayTasks} onNavigate={() => navigate('/tasks')} />
        )}

        {/* Upcoming Tasks */}
        {upcomingTasks.length > 0 && (
          <UpcomingTasksSection tasks={upcomingTasks} currency={settings.defaultCurrency} onNavigate={() => navigate('/tasks')} />
        )}

        {/* Budget bar */}
        {overallBudget && (
          <div className="card p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-2 uppercase tracking-wide">Monthly Budget</span>
              <span className="text-xs font-bold" style={{ color: budgetPct > 85 ? 'var(--expense)' : 'var(--brand)' }}>
                {budgetPct.toFixed(0)}% used
              </span>
            </div>
            <div className="h-2 bg-card3 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${budgetPct}%`,
                  background: budgetPct > 85 ? 'linear-gradient(90deg, #ff6b6b, #ee3c3c)' : 'linear-gradient(90deg, #7c5cfc, #a855f7)'
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-3">
              <span>{fmt(summary.total)} spent</span>
              <span>{fmt(Math.max(overallBudget.amount - summary.total, 0))} left</span>
            </div>
          </div>
        )}

        {/* Trend sparkline */}
        {trendData.some(d => d.amount > 0) && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-1">Spending Trend</p>
              <button onClick={() => navigate('/reports')} className="flex items-center gap-1 text-xs text-brand tap">
                Full report <ArrowRight size={12} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={trendData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c5cfc" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#7c5cfc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', borderRadius: '0.875rem', color: 'var(--text)', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                  formatter={(v) => [fmt(Number(v)), 'Spent']}
                  cursor={{ stroke: '#7c5cfc', strokeWidth: 1, strokeDasharray: '4 2' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#7c5cfc" strokeWidth={2} fill="url(#tg)" dot={false} activeDot={{ r: 4, fill: '#7c5cfc', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top categories */}
        {categoryChartData.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-1">Top Categories</p>
              <button onClick={() => navigate('/reports')} className="flex items-center gap-1 text-xs text-brand tap">
                See all <ArrowRight size={12} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {categoryChartData.map(cat => {
                const pct = summary.total > 0 ? (cat.value / summary.total) * 100 : 0
                return (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 icon-circle text-base shrink-0" style={{ backgroundColor: `${cat.color}20`, borderRadius: '0.75rem' }}>
                      <span>{cat.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-1 truncate">{cat.name}</span>
                        <span className="text-sm font-bold text-1 ml-2">{fmt(cat.value)}</span>
                      </div>
                      <div className="h-1 bg-card3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent transactions — clickable via ExpenseItem */}
        {recent.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-sm font-semibold text-1">Recent Expenses</p>
              <button onClick={() => navigate('/expenses')} className="flex items-center gap-1 text-xs text-brand tap">
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div>
              {recent.map(e => (
                <ExpenseItem key={e.id} expense={e} compact />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {expenses.length === 0 && (
          <div className="card flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">💸</div>
            <p className="text-lg font-bold text-1 mb-1">Start tracking!</p>
            <p className="text-sm text-2 mb-5 max-w-[260px] leading-relaxed">Add your first expense to see your financial picture.</p>
            <button onClick={() => setAddOpen(true)} className="btn btn-brand px-6 py-3 text-sm rounded-xl">
              <Plus size={15} /> Add Expense
            </button>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
        <ExpenseForm onClose={() => { setAddOpen(false); load() }} />
      </Modal>
    </div>
  )
}

// ─── Today's Tasks Strip ──────────────────────────────────────────────────────
function TodayTasksStrip({ tasks, onNavigate }: { tasks: Task[]; onNavigate: () => void }) {
  const { markDone } = useTaskStore()
  return (
    <div className="card p-4" style={{ borderLeft: '3px solid #f59e0b' }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className="text-xs font-bold text-1">Today's Tasks</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            {tasks.length}
          </span>
        </div>
        <button onClick={onNavigate} className="flex items-center gap-1 text-xs text-brand tap">
          All tasks <ArrowRight size={10} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {tasks.slice(0, 3).map(task => (
          <button
            key={task.id}
            onClick={() => markDone(task.id)}
            className="flex items-center gap-2.5 py-1 tap rounded-lg text-left w-full"
          >
            <Square size={15} className="text-3 shrink-0" />
            <span className="text-sm text-1 flex-1 truncate">{task.title}</span>
            {task.amount != null && task.amount > 0 && (
              <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--brand)' }}>
                ~{task.amount.toFixed(0)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Upcoming Tasks Section ───────────────────────────────────────────────────
function UpcomingTasksSection({ tasks, currency, onNavigate }: { tasks: Task[]; currency: string; onNavigate: () => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-sm font-semibold text-1">Upcoming</p>
        <button onClick={onNavigate} className="flex items-center gap-1 text-xs text-brand tap">
          See all <ArrowRight size={12} />
        </button>
      </div>
      <div className="flex flex-col">
        {tasks.map((task, i) => {
          const d = task.dueDate ? new Date(task.dueDate) : null
          const dueLbl = d
            ? isToday(d) ? 'Today'
            : isTomorrow(d) ? 'Tomorrow'
            : isPast(d) ? 'Overdue'
            : format(d, 'MMM d')
            : null
          const dueColor = d && isPast(d) && !isToday(d) ? '#ff6b6b' : d && isToday(d) ? '#f59e0b' : 'var(--text-3)'
          const checklistTotal = task.type === 'checklist'
            ? (task.items ?? []).reduce((s, item) => s + (item.estimatedPrice ?? 0) * (item.quantity ?? 1), 0)
            : 0
          const displayAmt = checklistTotal > 0 ? checklistTotal : task.amount
          const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency[0]
          return (
            <div
              key={task.id}
              className={cn('flex items-center gap-3 px-4 py-3', i < tasks.length - 1 && 'border-b border-ui')}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,92,252,0.12)' }}>
                {task.type === 'checklist'
                  ? <ShoppingCart size={14} style={{ color: 'var(--brand)' }} />
                  : <ListTodo size={14} style={{ color: 'var(--brand)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-1 truncate">{task.title}</p>
                {dueLbl && (
                  <p className="text-[10px] font-semibold mt-0.5" style={{ color: dueColor }}>{dueLbl}</p>
                )}
              </div>
              {displayAmt != null && displayAmt > 0 && (
                <span className="text-xs font-bold shrink-0" style={{ color: 'var(--brand)' }}>
                  ~{sym}{displayAmt.toFixed(0)}
                </span>
              )}
              {task.type === 'checklist' && task.items?.length ? (
                <span className="text-[10px] text-3 shrink-0">
                  {task.items.filter(i => i.checked).length}/{task.items.length}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Subscription Reminder Strip ─────────────────────────────────────────────
function SubscriptionStrip({
  expenses, categories, fmt,
}: {
  expenses: Expense[]
  categories: import('@/core/types').Category[]
  fmt: (v: number) => string
}) {
  const upcoming = expenses
    .filter(e => e.recurrence?.nextDate)
    .sort((a, b) => (a.recurrence!.nextDate! - b.recurrence!.nextDate!))
    .slice(0, 5)

  if (upcoming.length === 0) return null

  return (
    <div className="card p-4" style={{ borderLeft: '3px solid var(--brand)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Bell size={13} style={{ color: 'var(--brand)' }} />
        <span className="text-xs font-bold text-1 uppercase tracking-wide">Upcoming Subscriptions</span>
      </div>
      <div className="flex flex-col gap-2">
        {upcoming.map(e => {
          const cat = categories.find(c => c.id === e.categoryId)
          const next = new Date(e.recurrence!.nextDate!)
          const daysAway = Math.ceil((next.getTime() - Date.now()) / 86400000)
          return (
            <div key={e.id} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{ background: `${cat?.color ?? '#7c5cfc'}18` }}
              >
                {cat?.icon ?? '🔁'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-1 truncate">{e.notes || cat?.name || 'Recurring'}</p>
                <p className="text-[10px] text-3">
                  {daysAway <= 0 ? 'Due today' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`}
                  {' · '}{e.recurrence!.interval}
                </p>
              </div>
              <span className="text-sm font-bold text-expense shrink-0">{fmt(e.amount)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Privacy Banner ───────────────────────────────────────────────────────────
function PrivacyBanner() {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden tap"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      onClick={() => setOpen(v => !v)}
    >
      {/* Collapsed — single row always visible */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,200,150,0.12)' }}
        >
          <ShieldCheck size={14} className="text-income" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold uppercase tracking-widest text-income">Enterprise-grade Privacy</span>
          {!open && (
            <span className="text-xs text-2 ml-2 font-normal normal-case tracking-normal">
              · Offline-first · Zero server storage
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className="text-3 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>

      {/* Expanded content */}
      {open && (
        <>
          <div className="h-px mx-4" style={{ background: 'var(--border)' }} />
          <div className="px-4 py-3.5 flex flex-col gap-3">
            <p className="text-sm font-medium text-1 leading-snug">
              Your data never leaves your control.
            </p>
            <p className="text-xs text-2 leading-relaxed">
              All transactions are stored locally on this device using IndexedDB. Cloud backup goes exclusively to your own Google Drive. No app server ever receives, stores, or processes your financial data.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
              {[
                [<ShieldCheck size={11} />, 'Offline-first'],
                [<HardDrive size={11} />, 'Device & Drive only'],
                [<ShieldCheck size={11} />, 'Zero telemetry'],
                [<HardDrive size={11} />, 'No third-party access'],
              ].map(([icon, label]) => (
                <span key={label as string} className="flex items-center gap-1.5 text-[11px] font-semibold text-income opacity-80">
                  {icon}{label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
