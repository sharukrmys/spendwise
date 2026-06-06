import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { NumPad } from '@/components/ui/NumPad'
import { toast } from '@/components/ui/Toast'
import { CURRENCIES } from '@/core/constants'
import { format } from 'date-fns'

/**
 * Minimal expense-entry page for home screen shortcut (/quick-add).
 * Shows amount → category → type in a full-screen, nav-free flow.
 * Bookmark this URL and add "Add to Home Screen" for instant access.
 */
export function QuickAddPage() {
  const navigate = useNavigate()
  const { addExpense } = useExpenseStore()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()

  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'amount' | 'category'>('amount')

  const currencySymbol = CURRENCIES.find(c => c.code === settings.defaultCurrency)?.symbol ?? settings.defaultCurrency[0]
  const numericAmount = parseFloat(amount) || 0

  const handleSave = async () => {
    if (numericAmount <= 0 || !categoryId) return
    setLoading(true)
    try {
      await addExpense({
        type,
        amount: numericAmount,
        currency: settings.defaultCurrency,
        categoryId,
        date: Date.now(),
        paymentMethod: settings.defaultPaymentMethod,
        tags: [],
        isRecurring: false,
      })
      toast.success(type === 'income' ? 'Income added!' : 'Expense added!')
      setTimeout(() => navigate('/'), 600)
    } catch {
      toast.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const parentCategories = categories.filter(c => !c.parentId)

  return (
    <div className="min-h-dvh bg-base flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-safe pb-4"
        style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 70%)' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>
            {format(new Date(), 'EEE, MMM d')}
          </p>
          <h1 className="text-xl font-bold" style={{ color: '#f0eeff' }}>Quick Add</h1>
        </div>
        <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-xl tap" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <X size={18} style={{ color: 'rgba(240,238,255,0.8)' }} />
        </button>
      </div>

      {/* Type toggle */}
      <div className="px-4 pt-4 flex gap-2">
        {(['expense', 'income'] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold tap transition-all ${
              type === t
                ? t === 'income' ? 'grad-income text-white shadow-lg' : 'grad-expense text-white shadow-lg'
                : 'bg-card2 text-2'
            }`}
          >
            {t === 'income' ? '↑ Income' : '↓ Expense'}
          </button>
        ))}
      </div>

      {/* Amount display */}
      <button
        onClick={() => setStep('amount')}
        className="flex items-end justify-center gap-1 py-8 tap"
      >
        <span className="text-4xl font-bold pb-1" style={{ color: numericAmount > 0 ? 'var(--text-3)' : 'var(--text-3)' }}>
          {currencySymbol}
        </span>
        <span
          className="text-6xl font-bold leading-none"
          style={{ color: numericAmount > 0 ? 'var(--text)' : 'var(--text-3)' }}
        >
          {amount || '0'}
        </span>
      </button>

      {/* Category grid */}
      <div className="px-4 flex-1 overflow-y-auto">
        <p className="text-xs font-bold text-3 uppercase tracking-widest mb-3">Category</p>
        <div className="grid grid-cols-4 gap-2">
          {parentCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className="flex flex-col items-center gap-1 py-3 rounded-2xl tap transition-all"
              style={categoryId === cat.id
                ? { background: `${cat.color}22`, border: `2px solid ${cat.color}55` }
                : { background: 'var(--bg-card)', border: '2px solid transparent' }}
            >
              <span className="text-2xl leading-none">{cat.icon}</span>
              <span className="text-[9px] font-semibold text-2 text-center leading-tight px-1 truncate w-full">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="px-4 pb-8 pt-4 safe-bottom">
        <button
          onClick={handleSave}
          disabled={numericAmount <= 0 || !categoryId || loading}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white tap transition-all"
          style={{
            background: numericAmount > 0 ? 'linear-gradient(135deg, #7c5cfc, #a855f7)' : 'var(--bg-card2)',
            color: numericAmount > 0 ? 'white' : 'var(--text-3)',
            boxShadow: numericAmount > 0 ? '0 6px 24px rgba(124,92,252,0.4)' : 'none',
          }}
        >
          <Check size={20} />
          {loading ? 'Saving…' : `Save ${type === 'income' ? 'Income' : 'Expense'}`}
        </button>
      </div>

      {/* NumPad */}
      {step === 'amount' && (
        <NumPad
          value={amount}
          onChange={setAmount}
          onConfirm={() => setStep('category')}
          onClose={() => setStep('category')}
          currencySymbol={currencySymbol}
          label={type === 'income' ? 'Income amount' : 'Expense amount'}
        />
      )}
    </div>
  )
}
