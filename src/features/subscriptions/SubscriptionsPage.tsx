import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Check, Trash2, RefreshCw, CalendarDays } from 'lucide-react'
import { expenseQueries } from '@/db/queries'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { formatCurrency } from '@/core/utils'
import { CURRENCIES } from '@/core/constants'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { markSubscriptionPaid, undoMarkSubscriptionPaid, effectiveNextDate, nextOccurrence } from '@/services/recurringProcessor'
import { toast } from '@/components/ui/Toast'
import { haptics } from '@/core/haptics'
import type { Expense } from '@/core/types'
import { format } from 'date-fns'

function daysUntil(ts: number) {
  return Math.ceil((ts - Date.now()) / 86400000)
}

function intervalLabel(interval: string) {
  return { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[interval] ?? interval
}

const INTERVAL_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'daily', label: 'Daily' },
] as const

type IntervalFilter = typeof INTERVAL_FILTERS[number]['key']

export function SubscriptionsPage() {
  const navigate = useNavigate()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()
  const { deleteExpense, undoDeleteExpense } = useExpenseStore()
  const [subscriptions, setSubscriptions] = useState<Expense[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [intervalFilter, setIntervalFilter] = useState<IntervalFilter>('all')
  const fmt = (v: number) => formatCurrency(v, settings.defaultCurrency, settings.showCents)

  // ─── Mark Paid confirmation ──────────────────────────────────────────
  // A lightweight review step rather than an instant action: amount and
  // next-due-date both default to the current schedule, but can be
  // adjusted in place to handle a price change, an early/late payment,
  // or a renewal that shifts the cadence.
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payNextDate, setPayNextDate] = useState('')
  const [confirmingPay, setConfirmingPay] = useState(false)
  const payDateRef = useRef<HTMLInputElement>(null)
  const payNextDateRef = useRef<HTMLInputElement>(null)
  const openPayDatePicker = () => { try { payDateRef.current?.showPicker() } catch { payDateRef.current?.click() } }
  const openPayNextDatePicker = () => { try { payNextDateRef.current?.showPicker() } catch { payNextDateRef.current?.click() } }

  const load = async () => {
    const all = await expenseQueries.getRecurring()
    setSubscriptions(all.filter(e => e.type !== 'income'))
  }

  useEffect(() => { load() }, [])

  const openPayModal = (e: Expense, evt: React.MouseEvent) => {
    evt.stopPropagation()
    const interval = e.recurrence?.interval ?? 'monthly'
    setPayingExpense(e)
    setPayAmount(e.amount.toString())
    setPayDate(format(new Date(), 'yyyy-MM-dd'))
    setPayNextDate(format(new Date(nextOccurrence(effectiveNextDate(e), interval)), 'yyyy-MM-dd'))
  }

  const handleConfirmPayment = async () => {
    if (!payingExpense) return
    const amt = parseFloat(payAmount)
    if (!payAmount || isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    setConfirmingPay(true)
    try {
      const result = await markSubscriptionPaid(payingExpense, {
        amount: parseFloat(amt.toFixed(2)),
        paidDate: new Date(`${payDate}T00:00:00`).getTime(),
        nextDate: new Date(`${payNextDate}T00:00:00`).getTime(),
      })
      setPayingExpense(null)
      await load()
      toast.undo('Marked as paid — added to transactions', async () => {
        await undoMarkSubscriptionPaid(result)
        await load()
        toast.info('Undone')
      })
    } catch {
      toast.error('Could not mark as paid')
    } finally {
      setConfirmingPay(false)
    }
  }

  // Removes the subscription template only — past transactions it already
  // generated (via auto-processing or Mark Paid) are untouched. The template
  // itself doubles as the transaction recorded when the subscription was
  // first added, so that one entry goes with it too, same as deleting any
  // other expense.
  const handleRemove = (e: Expense, evt: React.MouseEvent) => {
    evt.stopPropagation()
    haptics.delete()
    deleteExpense(e.id)
    setSubscriptions(subs => subs.filter(s => s.id !== e.id))
    toast.undo('Subscription removed', () => {
      undoDeleteExpense(e.id)
      load()
    })
  }

  // Headline commitment always reflects every subscription, regardless of
  // which frequency tab is selected below.
  const monthlyTotal = useMemo(() => {
    return subscriptions.reduce((sum, e) => {
      const interval = e.recurrence?.interval ?? 'monthly'
      const multiplier = interval === 'daily' ? 30 : interval === 'weekly' ? 4.33 : interval === 'yearly' ? 1 / 12 : 1
      return sum + e.amount * multiplier
    }, 0)
  }, [subscriptions])

  const filteredSubscriptions = useMemo(() =>
    intervalFilter === 'all'
      ? subscriptions
      : subscriptions.filter(e => (e.recurrence?.interval ?? 'monthly') === intervalFilter),
    [subscriptions, intervalFilter]
  )

  const upcoming = useMemo(() =>
    [...filteredSubscriptions].sort((a, b) => effectiveNextDate(a) - effectiveNextDate(b)),
    [filteredSubscriptions]
  )

  // "Upcoming" mirrors the dashboard's 2-week reminder window — anything
  // further out still shows up below in "Later", so every subscription
  // stays visible on this one screen no matter how far away it's due.
  const overdue = useMemo(() => upcoming.filter(e => daysUntil(effectiveNextDate(e)) <= 0), [upcoming])
  const soon = useMemo(() => upcoming.filter(e => { const d = daysUntil(effectiveNextDate(e)); return d > 0 && d <= 14 }), [upcoming])
  const later = useMemo(() => upcoming.filter(e => daysUntil(effectiveNextDate(e)) > 14), [upcoming])

  const SubscriptionRow = ({ e }: { e: Expense }) => {
    const cat = categories.find(c => c.id === e.categoryId)
    const next = new Date(effectiveNextDate(e))
    const days = daysUntil(next.getTime())
    const isOverdue = days <= 0
    const isSoon = days > 0 && days <= 14
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-ui last:border-0 tap"
        onClick={() => setEditingExpense(e)}
      >
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
                {' · Yet to pay · '}
                {isOverdue ? 'Overdue' : days === 1 ? 'Tomorrow' : next ? format(next, 'MMM d') : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-sm font-bold text-expense">{fmt(e.amount)}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={evt => handleRemove(e, evt)}
              aria-label="Remove subscription"
              className="flex items-center justify-center w-5 h-5 rounded-full tap"
              style={{ background: 'rgba(255,107,107,0.12)', color: 'var(--expense)' }}
            >
              <Trash2 size={10} />
            </button>
            <button
              onClick={evt => openPayModal(e, evt)}
              className="flex items-center gap-1 text-[10px] font-semibold pl-1.5 pr-2 py-1 rounded-full tap"
              style={{ background: 'rgba(0,200,150,0.12)', color: 'var(--income)' }}
            >
              <Check size={10} strokeWidth={3} /> Mark paid
            </button>
          </div>
        </div>
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

      {subscriptions.length > 0 && (
        <div className="flex gap-2 px-4 pt-4 overflow-x-auto">
          {INTERVAL_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setIntervalFilter(f.key)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold tap shrink-0"
              style={
                intervalFilter === f.key
                  ? { background: 'var(--brand)', color: '#fff' }
                  : { background: 'var(--bg-card2)', color: 'var(--text-2)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-28 px-0">
        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <RefreshCw size={36} className="mb-4 text-3" />
            <p className="text-base font-semibold text-1 mb-1">No subscriptions yet</p>
            <p className="text-sm text-2 mb-5">Add a recurring expense to track it here.</p>
            <button onClick={() => setAddOpen(true)} className="btn btn-brand px-6 py-3 text-sm rounded-xl">
              <Plus size={15} /> Add Subscription
            </button>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <p className="text-sm text-2">No {intervalFilter} subscriptions.</p>
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
                <p className="text-xs font-bold uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: '#f59e0b' }}>Upcoming (2 weeks)</p>
                {soon.map(e => <SubscriptionRow key={e.id} e={e} />)}
              </div>
            )}

            {later.length > 0 && (
              <div className="mt-4 mx-4 card overflow-hidden">
                <p className="text-xs font-bold uppercase tracking-widest px-4 pt-3 pb-1 text-3">Later</p>
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

      <Modal open={!!editingExpense} onClose={() => setEditingExpense(null)} title="Edit Subscription">
        {editingExpense && (
          <ExpenseForm
            expense={editingExpense}
            onClose={() => { setEditingExpense(null); load() }}
          />
        )}
      </Modal>

      <Modal open={!!payingExpense} onClose={() => setPayingExpense(null)} title="Confirm Payment">
        {payingExpense && (() => {
          const cat = categories.find(c => c.id === payingExpense.categoryId)
          const currencySymbol = CURRENCIES.find(c => c.code === payingExpense.currency)?.symbol ?? payingExpense.currency[0]
          const enteredAmount = parseFloat(payAmount) || 0
          const priceChanged = payAmount !== '' && enteredAmount !== payingExpense.amount
          return (
            <div className="px-1 pb-2 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: `${cat?.color ?? '#7c5cfc'}18` }}
                >
                  {cat?.icon ?? '🔁'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-1 truncate">{payingExpense.notes || cat?.name || 'Subscription'}</p>
                  <p className="text-xs text-3">{intervalLabel(payingExpense.recurrence?.interval ?? 'monthly')}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-3 font-semibold uppercase tracking-wide mb-1.5">Amount paid</p>
                <div className="flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                  <span className="text-lg font-bold shrink-0" style={{ color: 'var(--text-3)' }}>{currencySymbol}</span>
                  <input
                    type="number" inputMode="decimal" value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="flex-1 bg-transparent text-xl font-bold text-1 outline-none min-w-0"
                  />
                </div>
                {priceChanged && (
                  <p className="text-[11px] mt-1.5" style={{ color: '#f59e0b' }}>
                    Updates this subscription's price from {fmt(payingExpense.amount)} to {fmt(enteredAmount)} going forward.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <div
                  className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
                  onClick={openPayDatePicker}
                >
                  <CalendarDays size={14} className="shrink-0 text-3" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-3 font-semibold uppercase tracking-wide">Paid on</p>
                    <p className="text-xs text-1 font-medium">{payDate && format(new Date(`${payDate}T00:00:00`), 'MMM d, yyyy')}</p>
                  </div>
                  <input
                    ref={payDateRef} type="date" value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>

                <div
                  className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
                  onClick={openPayNextDatePicker}
                >
                  <span className="text-sm shrink-0">⏭️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-3 font-semibold uppercase tracking-wide">Next due</p>
                    <p className="text-xs text-1 font-medium">{payNextDate && format(new Date(`${payNextDate}T00:00:00`), 'MMM d, yyyy')}</p>
                  </div>
                  <input
                    ref={payNextDateRef} type="date" value={payNextDate}
                    onChange={e => setPayNextDate(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              <button
                onClick={handleConfirmPayment}
                disabled={confirmingPay}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white tap disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #00c896, #00a77a)' }}
              >
                {confirmingPay ? 'Saving…' : 'Confirm Payment'}
              </button>
              <button className="text-sm text-3 tap text-center py-1" onClick={() => setPayingExpense(null)}>Cancel</button>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
