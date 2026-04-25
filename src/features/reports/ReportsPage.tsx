import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area
} from 'recharts'
import { Download } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { expenseQueries } from '@/db/queries'
import { formatCurrency, getMonthRange, getYearRange, buildTrendData, summarizeExpenses, cn } from '@/core/utils'
import { PAYMENT_METHOD_LABELS, CHART_COLORS } from '@/core/constants'
import { format, subMonths, subYears } from 'date-fns'
import type { Expense } from '@/core/types'
import { exportPersonalMonthly } from '@/services/exportXlsx'

type Period = 'month' | 'quarter' | 'year'

export function ReportsPage() {
  const { settings } = useSettingsStore()
  const { categories } = useCategoryStore()
  const [period, setPeriod] = useState<Period>('month')
  const [expenses, setExpenses] = useState<Expense[]>([])

  useEffect(() => {
    const load = async () => {
      let exps: Expense[]
      if (period === 'month') {
        const r = getMonthRange()
        exps = await expenseQueries.getByRange(r.start, r.end)
      } else if (period === 'quarter') {
        const r = getMonthRange(subMonths(new Date(), 2))
        exps = await expenseQueries.getByRange(r.start, getMonthRange().end)
      } else {
        const r = getYearRange()
        exps = await expenseQueries.getByRange(r.start, r.end)
      }
      setExpenses(exps)
    }
    load()
  }, [period])

  const summary = useMemo(() => summarizeExpenses(expenses), [expenses])
  const incomeTotal = useMemo(() => expenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0), [expenses])
  const onlyExpenses = useMemo(() => expenses.filter(e => e.type !== 'income'), [expenses])
  const trendData = useMemo(() => buildTrendData(onlyExpenses, period === 'year' ? 12 : 6), [onlyExpenses, period])

  const categoryData = useMemo(() =>
    Object.entries(summary.byCategory)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId)
        return { name: cat?.name ?? 'Other', value: amount, color: cat?.color ?? '#7c5cfc', icon: cat?.icon }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 7),
    [summary.byCategory, categories]
  )

  const dowData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
    day,
    amount: parseFloat(
      onlyExpenses
        .filter(e => new Date(e.date).getDay() === (i + 1) % 7)
        .reduce((s, e) => s + e.amount, 0)
        .toFixed(2)
    ),
  }))

  const paymentData = Object.entries(summary.byPaymentMethod).map(([method, amount]) => ({
    name: PAYMENT_METHOD_LABELS[method] ?? method,
    value: parseFloat(amount.toFixed(2)),
  }))

  const maxDowIdx = dowData.reduce((max, d, i, arr) => d.amount > arr[max].amount ? i : max, 0)
  const dayCount = period === 'month' ? 30 : period === 'quarter' ? 90 : 365
  const fmt = (v: number) => formatCurrency(v, settings.defaultCurrency, false)

  const savingsRate = incomeTotal > 0 ? Math.max(0, ((incomeTotal - summary.total) / incomeTotal) * 100) : null
  const topCat = categoryData[0] ?? null
  const netBalance = incomeTotal - summary.total

  const [lastYearExpenses, setLastYearExpenses] = useState<Expense[]>([])

  useEffect(() => {
    const r = getYearRange(subYears(new Date(), 1))
    expenseQueries.getByRange(r.start, r.end).then(setLastYearExpenses)
  }, [])

  // Weekday vs weekend split
  const weekdayTotal = useMemo(() =>
    onlyExpenses.filter(e => { const d = new Date(e.date).getDay(); return d >= 1 && d <= 5 }).reduce((s, e) => s + e.amount, 0),
    [onlyExpenses]
  )
  const weekendTotal = useMemo(() =>
    onlyExpenses.filter(e => { const d = new Date(e.date).getDay(); return d === 0 || d === 6 }).reduce((s, e) => s + e.amount, 0),
    [onlyExpenses]
  )

  // YoY: compare current month vs same month last year
  const thisMonthTotal = useMemo(() => {
    const r = getMonthRange()
    return expenses.filter(e => e.type !== 'income' && e.date >= r.start && e.date <= r.end).reduce((s, e) => s + e.amount, 0)
  }, [expenses])
  const lastYearSameMonthTotal = useMemo(() => {
    const r = getMonthRange(subYears(new Date(), 1))
    return lastYearExpenses.filter(e => e.type !== 'income' && e.date >= r.start && e.date <= r.end).reduce((s, e) => s + e.amount, 0)
  }, [lastYearExpenses])
  const yoyChange = lastYearSameMonthTotal > 0 ? ((thisMonthTotal - lastYearSameMonthTotal) / lastYearSameMonthTotal) * 100 : null

  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const allExpenses = await expenseQueries.getAll()
      await exportPersonalMonthly(allExpenses, categories, settings.defaultCurrency, settings.showCents)
    } catch (e) {
      console.error('Export failed', e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* ─── Header ───────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-5">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(200,195,240,0.6)' }}>{format(new Date(), 'MMMM yyyy')}</p>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold" style={{ color: '#f0eeff' }}>Reports</h1>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl tap text-xs font-semibold transition-opacity"
            style={{ background: 'rgba(124,92,252,0.18)', border: '1px solid rgba(124,92,252,0.3)', color: '#c8c3f0', opacity: exporting ? 0.6 : 1 }}
          >
            <Download size={13} className={exporting ? 'animate-pulse' : ''} />
            {exporting ? 'Exporting…' : 'Export XLSX'}
          </button>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
          {(['month', 'quarter', 'year'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'flex-1 py-2.5 text-sm font-semibold rounded-xl tap transition-all capitalize',
                period === p ? 'grad-brand text-white shadow-lg' : ''
              )}
              style={period !== p ? { color: 'rgba(200,195,240,0.7)' } : undefined}
            >
              {p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : 'Year'}
            </button>
          ))}
        </div>

        {/* Summary pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm font-bold text-expense truncate">{fmt(summary.total)}</p>
            <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>Spent</p>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm font-bold text-income truncate">{fmt(incomeTotal)}</p>
            <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>Income</p>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm font-bold truncate" style={{ color: '#f0eeff' }}>{fmt(summary.total / Math.max(1, dayCount))}</p>
            <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>Daily avg</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 pb-28">
        {/* ─── Smart Insights ───────────────────── */}
        {expenses.length > 0 && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-1 mb-3">Insights</p>
            <div className="flex flex-col gap-2.5">
              {savingsRate !== null && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: savingsRate >= 20 ? 'rgba(0,200,150,0.08)' : savingsRate > 0 ? 'rgba(255,193,7,0.08)' : 'rgba(255,107,107,0.08)' }}>
                  <span className="text-xl">{savingsRate >= 20 ? '🎯' : savingsRate > 0 ? '⚠️' : '🔴'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-1">
                      {savingsRate >= 20 ? `Saving ${savingsRate.toFixed(0)}% of income` : savingsRate > 0 ? `Only saving ${savingsRate.toFixed(0)}% — try to reach 20%` : 'Spending exceeds income'}
                    </p>
                    <p className="text-xs text-2">
                      Net {netBalance >= 0 ? '+' : ''}{fmt(netBalance)} this {period}
                    </p>
                  </div>
                </div>
              )}
              {topCat && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(124,92,252,0.06)' }}>
                  <span className="text-xl">{topCat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-1">Top spend: {topCat.name}</p>
                    <p className="text-xs text-2">
                      {fmt(topCat.value)} · {summary.total > 0 ? ((topCat.value / summary.total) * 100).toFixed(0) : 0}% of total spending
                    </p>
                  </div>
                </div>
              )}
              {dowData[maxDowIdx].amount > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,193,7,0.06)' }}>
                  <span className="text-xl">📅</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-1">You spend most on {dowData[maxDowIdx].day}s</p>
                    <p className="text-xs text-2">Avg {fmt(dowData[maxDowIdx].amount / Math.ceil(dayCount / 7))} per {dowData[maxDowIdx].day}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Trend chart ──────────────────────── */}
        {trendData.some(d => d.amount > 0) && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-1 mb-3">Spending Trend</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c5cfc" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7c5cfc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${fmt(v)}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', borderRadius: '0.875rem', color: 'var(--text)', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                  formatter={(v) => [fmt(Number(v)), 'Spent']}
                  cursor={{ stroke: '#7c5cfc', strokeWidth: 1, strokeDasharray: '4 2' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#7c5cfc" strokeWidth={2.5} fill="url(#rg)" dot={false} activeDot={{ r: 4, fill: '#7c5cfc', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ─── Category breakdown ───────────────── */}
        {categoryData.length > 0 && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-1 mb-4">By Category</p>
            <div className="flex flex-col gap-3">
              {categoryData.map(cat => {
                const pct = summary.total > 0 ? (cat.value / summary.total) * 100 : 0
                return (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="w-9 h-9 icon-circle text-lg shrink-0" style={{ backgroundColor: `${cat.color}20`, borderRadius: '0.875rem' }}>
                      <span>{cat.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-medium text-1 truncate">{cat.name}</span>
                        <span className="text-sm font-bold text-1">{fmt(cat.value)}</span>
                      </div>
                      <div className="h-1.5 bg-card3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                      <p className="text-[10px] text-3 mt-0.5">{pct.toFixed(1)}% of total</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Busiest days ─────────────────────── */}
        {onlyExpenses.length > 0 && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-1 mb-3">Busiest Days</p>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={dowData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border2)', borderRadius: '0.875rem', color: 'var(--text)', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                  formatter={(v) => [fmt(Number(v)), '']}
                  cursor={{ fill: 'rgba(124,92,252,0.06)' }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {dowData.map((_, i) => (
                    <Cell key={i} fill={i === maxDowIdx ? '#7c5cfc' : 'rgba(124,92,252,0.3)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ─── Weekday vs Weekend ───────────────── */}
        {onlyExpenses.length > 0 && (weekdayTotal > 0 || weekendTotal > 0) && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-1 mb-4">Weekday vs Weekend</p>
            <div className="flex gap-3">
              {[
                { label: 'Weekdays', amount: weekdayTotal, icon: '💼', color: '#7c5cfc' },
                { label: 'Weekends', amount: weekendTotal, icon: '🎉', color: '#ec4899' },
              ].map(item => {
                const total = weekdayTotal + weekendTotal
                const pct = total > 0 ? (item.amount / total) * 100 : 0
                return (
                  <div key={item.label} className="flex-1 rounded-2xl p-3 text-center" style={{ background: `${item.color}10`, border: `1px solid ${item.color}25` }}>
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <p className="text-xs font-semibold text-2 mb-1">{item.label}</p>
                    <p className="text-base font-bold text-1">{fmt(item.amount)}</p>
                    <p className="text-[10px] font-semibold mt-0.5" style={{ color: item.color }}>{pct.toFixed(0)}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Year-over-year ───────────────────── */}
        {yoyChange !== null && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-1 mb-3">Year-over-Year</p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[10px] text-3 uppercase tracking-wide mb-0.5">This {format(new Date(), 'MMMM')}</p>
                <p className="text-lg font-bold text-expense">{fmt(thisMonthTotal)}</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-3 uppercase tracking-wide mb-0.5">Last year</p>
                <p className="text-lg font-bold text-2">{fmt(lastYearSameMonthTotal)}</p>
              </div>
            </div>
            <div
              className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl"
              style={{ background: yoyChange > 0 ? 'rgba(255,107,107,0.1)' : 'rgba(0,200,150,0.1)' }}
            >
              <span className="text-xl">{yoyChange > 0 ? '📈' : '📉'}</span>
              <p className="text-sm font-semibold" style={{ color: yoyChange > 0 ? 'var(--expense)' : 'var(--income)' }}>
                {yoyChange > 0 ? '+' : ''}{yoyChange.toFixed(1)}% vs last {format(new Date(), 'MMMM yyyy')}
              </p>
            </div>
          </div>
        )}

        {/* ─── Payment methods ──────────────────── */}
        {paymentData.length > 0 && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-1 mb-4">Payment Methods</p>
            <div className="flex flex-col gap-3">
              {paymentData.map((p, i) => {
                const maxVal = Math.max(...paymentData.map(d => d.value), 1)
                const pct = (p.value / maxVal) * 100
                const color = CHART_COLORS[i % CHART_COLORS.length]
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 icon-circle text-sm shrink-0" style={{ backgroundColor: `${color}20`, borderRadius: '0.75rem', color }}>
                      <span>💳</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-medium text-1 truncate">{p.name}</span>
                        <span className="text-sm font-bold text-1">{fmt(p.value)}</span>
                      </div>
                      <div className="h-1.5 bg-card3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Top expenses ─────────────────────── */}
        {onlyExpenses.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-semibold text-1">Top Expenses</p>
            </div>
            <div className="flex flex-col">
              {[...onlyExpenses]
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5)
                .map((e, i) => {
                  const cat = categories.find(c => c.id === e.categoryId)
                  return (
                    <div key={e.id} className={cn('flex items-center gap-3 px-4 py-3', i < 4 && 'border-b border-ui')}>
                      <span className="text-xs font-bold text-3 w-4 shrink-0">{i + 1}</span>
                      <div className="w-8 h-8 icon-circle text-base shrink-0" style={{ backgroundColor: `${cat?.color ?? '#7c5cfc'}18`, borderRadius: '0.75rem' }}>
                        <span>{cat?.icon ?? '📦'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-1 truncate">{e.notes || cat?.name || 'Expense'}</p>
                        <p className="text-xs text-3">{format(new Date(e.date), 'MMM d')}</p>
                      </div>
                      <span className="text-sm font-bold text-expense">{fmt(e.amount)}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {expenses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-base font-semibold text-1 mb-1">No data yet</p>
            <p className="text-sm text-2">Add some transactions to see reports.</p>
          </div>
        )}
      </div>
    </div>
  )
}
