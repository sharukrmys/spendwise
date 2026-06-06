import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { expenseQueries } from '@/db/queries'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { formatCurrency } from '@/core/utils'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import type { Expense } from '@/core/types'
import { format } from 'date-fns'

function daysUntil(ts: number) {
  return Math.ceil((ts - Date.now()) / 86400000)
}

function intervalLabel(interval: string) {
  return { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[interval] ?? interval
}

export function SubscriptionsPage() {
  const navigate = useNavigate()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()
  const [subscriptions, setSubscriptions] = useState<Expense[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const fmt = (v: number) => formatCurrency(v, settings.defaultCurrency, settings.showCents)

  const load = async () => {
    const all = await expenseQueries.getRecurring()
    setSubscriptions(all.filter(e => e.type !== 'income'))
  }

  useEffect(() => { load() }, [])

  const monthlyTotal = useMemo(() => {
    return subscriptions.reduce((sum, e) => {
      const interval = e.recurrence?.interval ?? 'monthly'
      const multiplier = interval === 'daily' ? 30 : interval === 'weekly' ? 4.33 : interval === 'yearly' ? 1 / 12 : 1
      return sum + e.amount * multiplier
    }, 0)
  }, [subscriptions])

  const upcoming = useMemo(() =>
    [...subscriptions]
      .filter(e => e.recurrence?.nextDate)
      .sort((a, b) => (a.recurrence!.nextDate! - b.recurrence!.nextDate!)),
    [subscriptions]
  )

  const overdue = useMemo(() => upcoming.filter(e => daysUntil(e.recurrence!.nextDate!) <= 0), [upcoming])
  const soon = useMemo(() => upcoming.filter(e => { const d = daysUntil(e.recurrence!.nextDate!); return d > 0 && d <= 7 }), [upcoming])
  const later = useMemo(() => upcoming.filter(e => daysUntil(e.recurrence!.nextDate!) > 7), [upcoming])

  const SubscriptionRow = ({ e }: { e: Expense }) => {
    const cat = categories.find(c => c.id === e.categoryId)
    const next = e.recurrence?.nextDate ? new Date(e.recurrence.nextDate) : null
    const days = next ? daysUntil(next.getTime()) : null
    const isOverdue = days !== null && days <= 0
    const isSoon = days !== null && days > 0 && days <= 7
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-ui last:border-0">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${cat?.color ?? '#7c5cfc'}18` }}
        >
          {cat?.icon ?? '🔁'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-1 truncate">{e.notes || cat?.name || 'Subscription'}</p>
          <p className="text-xs text-3">
            {intervalLabel(e.recurrence?.interval ?? 'monthly')}
            {next && (
              <span style={{ color: isOverdue ? 'var(--expense)' : isSoon ? '#f59e0b' : 'var(--text-3)' }}>
                {' · '}
                {isOverdue ? 'Overdue' : days === 1 ? 'Tomorrow' : next ? format(next, 'MMM d') : ''}
              </span>
            )}
          </p>
        </div>
        <span className="text-sm font-bold text-expense shrink-0">{fmt(e.amount)}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-xl tap" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <ArrowLeft size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#f0eeff' }}>Subscriptions</h1>
            <p className="text-xs" style={{ color: 'rgba(200,195,240,0.5)' }}>Recurring expenses</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-xl tap"
            style={{ background: 'rgba(124,92,252,0.25)', border: '1px solid rgba(124,92,252,0.4)' }}
          >
            <Plus size={18} style={{ color: '#c4b5fd' }} />
          </button>
        </div>

        {/* Monthly total */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(200,195,240,0.5)' }}>
            Monthly commitment
          </p>
          <p className="text-3xl font-bold" style={{ color: '#f0eeff' }}>{fmt(monthlyTotal)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(200,195,240,0.4)' }}>
            {subscriptions.length} active subscription{subscriptions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 px-0">
        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="text-5xl mb-4">🔁</div>
            <p className="text-base font-semibold text-1 mb-1">No subscriptions yet</p>
            <p className="text-sm text-2 mb-5">Add a recurring expense to track it here.</p>
            <button onClick={() => setAddOpen(true)} className="btn btn-brand px-6 py-3 text-sm rounded-xl">
              <Plus size={15} /> Add Subscription
            </button>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="mt-4 mx-4 card overflow-hidden" style={{ borderLeft: '3px solid var(--expense)' }}>
                <p className="text-xs font-bold uppercase tracking-widest px-4 pt-3 pb-1 text-expense">Overdue</p>
                {overdue.map(e => <SubscriptionRow key={e.id} e={e} />)}
              </div>
            )}

            {soon.length > 0 && (
              <div className="mt-4 mx-4 card overflow-hidden" style={{ borderLeft: '3px solid #f59e0b' }}>
                <p className="text-xs font-bold uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: '#f59e0b' }}>Due this week</p>
                {soon.map(e => <SubscriptionRow key={e.id} e={e} />)}
              </div>
            )}

            {later.length > 0 && (
              <div className="mt-4 mx-4 card overflow-hidden">
                <p className="text-xs font-bold uppercase tracking-widest px-4 pt-3 pb-1 text-3">Upcoming</p>
                {later.map(e => <SubscriptionRow key={e.id} e={e} />)}
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Subscription">
        <ExpenseForm
          defaultType="expense"
          onClose={() => { setAddOpen(false); load() }}
        />
      </Modal>
    </div>
  )
}
