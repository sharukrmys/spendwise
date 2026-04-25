import { useState, useMemo, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { RefreshCw, Camera, X, Hash, Clipboard } from 'lucide-react'
import { Select } from '@/components/ui/Input'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGroupStore } from '@/store/useGroupStore'
import { toast } from '@/components/ui/Toast'
import type { Expense, Group, PaymentMethod, RecurrenceInterval, Tag } from '@/core/types'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, CURRENCIES } from '@/core/constants'
import { cn } from '@/core/utils'
import { tagQueries } from '@/db/queries'
import { parseSMS, merchantToNotes } from '@/core/smsParser'

interface ExpenseFormProps {
  onClose: () => void
  expense?: Expense
  defaultType?: 'expense' | 'income'
  /** When set, renders in group-expense mode: group fields always visible, no personal entry saved */
  group?: Group
  /** Pre-fill values from share target or quick-add */
  prefill?: { amount?: number; notes?: string }
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value: value as PaymentMethod, label: `${PAYMENT_METHOD_ICONS[value]} ${label}` })
)

const QUICK_COLORS = ['#7c5cfc', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#ef4444', '#f97316', '#8b5cf6']

const RECENT_CATS_KEY = 'em-recent-cats'
function getRecentCatIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_CATS_KEY) ?? '[]') } catch { return [] }
}
function saveRecentCatId(id: string) {
  const updated = [id, ...getRecentCatIds().filter(r => r !== id)].slice(0, 8)
  localStorage.setItem(RECENT_CATS_KEY, JSON.stringify(updated))
}

async function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 900
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.65))
    }
    img.src = url
  })
}

export function ExpenseForm({ onClose, expense, defaultType = 'expense', group, prefill }: ExpenseFormProps) {
  const { addExpense, updateExpense, load } = useExpenseStore()
  const { categories, addCategory } = useCategoryStore()
  const { settings } = useSettingsStore()
  const { groups, addGroupExpense } = useGroupStore()

  const [type, setType] = useState<'expense' | 'income'>(expense?.type ?? defaultType)
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? prefill?.amount?.toString() ?? '')
  // Group mode: currency is fixed to the group's currency
  const [currency, setCurrency] = useState(expense?.currency ?? (group ? group.currency : settings.defaultCurrency))
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? categories[0]?.id ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? prefill?.notes ?? '')
  const [date, setDate] = useState(
    expense ? format(new Date(expense.date), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(expense?.paymentMethod ?? settings.defaultPaymentMethod)
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring ?? false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval>(expense?.recurrence?.interval ?? 'monthly')
  const [receipt, setReceipt] = useState<string | null>(expense?.attachments?.[0] ?? null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [newCatColor, setNewCatColor] = useState(QUICK_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showTags, setShowTags] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [showCurrency, setShowCurrency] = useState(false)

  // Tags
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(expense?.tags ?? [])
  const [tagInput, setTagInput] = useState('')

  // Personal-expense group split (pill mode — not used in group mode)
  const [splitGroupId, setSplitGroupId] = useState<string | null>(null)
  const [splitPaidBy, setSplitPaidBy] = useState<string>('')

  // Group mode: paid-by + split (always shown when group prop is set)
  const [paidBy, setPaidBy] = useState(group?.members[0]?.id ?? '')
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})

  const [showSmsInput, setShowSmsInput] = useState(false)
  const [smsText, setSmsText] = useState('')

  const receiptRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => { tagQueries.getAll().then(setAllTags) }, [])
  useEffect(() => { setTimeout(() => amountRef.current?.focus(), 80) }, [])

  const handleSmsParse = (text: string) => {
    const parsed = parseSMS(text)
    if (!parsed.amount && !parsed.merchant) {
      toast.error('Could not read transaction details')
      return
    }
    if (parsed.amount) setAmount(parsed.amount.toString())
    if (parsed.type) setType(parsed.type)
    if (parsed.merchant) setNotes(merchantToNotes(parsed.merchant))
    if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod)
    if (parsed.categoryHint) {
      const hint = parsed.categoryHint.toLowerCase()
      const match = categories.find(c =>
        c.name.toLowerCase().includes(hint) || hint.includes(c.name.toLowerCase())
      )
      if (match) setCategoryId(match.id)
    }
    setShowSmsInput(false)
    setSmsText('')
    toast.success(parsed.confidence === 'high' ? 'Parsed from SMS ✓' : `Parsed · ${parsed.confidence} confidence`)
  }

  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) { handleSmsParse(text); return }
    } catch { /* permission denied — fall through */ }
    setShowSmsInput(v => !v)
  }

  const toggleTag = (id: string) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const handleAddTag = async () => {
    const name = tagInput.trim()
    if (!name) return
    const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (existing) { toggleTag(existing.id); setTagInput(''); return }
    const TAG_COLORS = ['#7c5cfc', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#ef4444', '#f97316']
    const color = TAG_COLORS[allTags.length % TAG_COLORS.length]
    const newTag = await tagQueries.add(name, color)
    setAllTags(prev => [...prev, newTag])
    setSelectedTagIds(prev => [...prev, newTag.id])
    setTagInput('')
  }

  const parentCategories = categories.filter(c => !c.parentId)

  const recentCatIds = useMemo(() => getRecentCatIds(), [])
  const sortedCats = useMemo(() => {
    const recent = recentCatIds.map(id => parentCategories.find(c => c.id === id)).filter(Boolean) as typeof parentCategories
    const others = parentCategories.filter(c => !recentCatIds.includes(c.id))
    return [...recent, ...others]
  }, [parentCategories, recentCatIds])

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency[0]

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) errs.amount = 'Enter a valid amount'
    // Category is required for personal expenses; optional for group expenses
    if (!group && !categoryId && type === 'expense') errs.categoryId = 'Pick a category'
    // Description is required in group mode
    if (group && !notes.trim()) errs.notes = 'Enter a description'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file)
      setReceipt(compressed)
    } catch { toast.error('Failed to attach image') }
    e.target.value = ''
  }

  const handleQuickAddCategory = async () => {
    if (!newCatName.trim()) return
    const newCat = await addCategory({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor, isDefault: false })
    setCategoryId(newCat.id)
    setNewCatName('')
    setNewCatIcon('📦')
    setShowQuickAdd(false)
    toast.success('Category added')
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const totalAmount = parseFloat(parseFloat(amount).toFixed(2))

      // ─── Group expense mode ───────────────────────────────────────────
      if (group) {
        if (group.members.length === 0) { toast.error('Add members first'); setLoading(false); return }
        if (!paidBy) { toast.error('Select who paid'); setLoading(false); return }
        const splits = group.members.map(m => {
          const splitAmount = splitType === 'equal'
            ? parseFloat((totalAmount / group.members.length).toFixed(2))
            : parseFloat(customSplits[m.id] ?? '0')
          return { memberId: m.id, amount: splitAmount, settled: m.id === paidBy }
        })
        if (categoryId) saveRecentCatId(categoryId)
        await addGroupExpense({
          groupId: group.id,
          description: notes.trim() || 'Expense',
          amount: totalAmount,
          currency: group.currency,
          paidBy,
          splits,
          date: new Date(date).getTime(),
          categoryId: (categoryId || categories[0]?.id) || undefined,
        })
        toast.success(`Added to ${group.name}!`)
        onClose()
        return
      }

      // ─── Personal expense mode ────────────────────────────────────────
      const data = {
        type,
        amount: totalAmount,
        currency,
        categoryId: (categoryId || categories[0]?.id) ?? '',
        notes: notes.trim() || undefined,
        date: new Date(date).getTime(),
        paymentMethod,
        tags: selectedTagIds,
        isRecurring,
        recurrence: isRecurring ? { interval: recurrenceInterval } : undefined,
        attachments: receipt ? [receipt] : (expense?.attachments ?? []),
      }
      if (data.categoryId) saveRecentCatId(data.categoryId)
      if (expense) {
        await updateExpense(expense.id, data)
        toast.success('Updated')
      } else {
        await addExpense(data)
        if (splitGroupId && type === 'expense') {
          const grp = groups.find(g => g.id === splitGroupId)
          if (grp && grp.members.length > 0) {
            const paidById = splitPaidBy || grp.members[0].id
            const perPerson = parseFloat((totalAmount / grp.members.length).toFixed(2))
            await addGroupExpense({
              groupId: grp.id,
              description: notes.trim() || 'Expense',
              amount: totalAmount,
              currency: grp.currency,
              paidBy: paidById,
              categoryId: data.categoryId || undefined,
              splits: grp.members.map(m => ({
                memberId: m.id,
                amount: perPerson,
                settled: m.id === paidById,
              })),
              date: data.date,
              notes: notes.trim() || undefined,
            })
            toast.success(`Added to ${grp.name}!`)
          }
        } else {
          toast.success(type === 'income' ? 'Income added!' : 'Expense added!')
        }
      }
      await load()
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const accentColor = type === 'income' ? 'var(--income)' : 'var(--expense)'
  const accentBg = type === 'income' ? 'rgba(0,200,150,0.08)' : 'rgba(255,107,107,0.07)'
  const gradBtn = group || type !== 'income'
    ? 'linear-gradient(135deg, #7c5cfc, #a855f7)'
    : 'linear-gradient(135deg, #00c896, #00a77a)'

  const pill = (active: boolean, color = '#7c5cfc') => active
    ? { background: `${color}18`, border: `1.5px solid ${color}45`, color }
    : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-3)' } as React.CSSProperties

  return (
    <div className="flex flex-col">

      {/* ─── Sticky top ─── */}
      <div className="sticky top-0 z-10 border-b border-ui" style={{ background: 'var(--bg-card)' }}>

        {group ? (
          /* Group mode: gradient header with group name + currency */
          <div className="px-4 pt-3 pb-1 text-center" style={{ background: 'linear-gradient(160deg,#2a1860,#16123a)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(200,195,240,0.5)' }}>
              {group.currency} · {group.name}
            </p>
            <div className="flex items-center justify-center gap-1 py-1">
              <span className="text-4xl font-bold" style={{ color: 'rgba(200,195,240,0.5)' }}>{currencySymbol}</span>
              <input
                ref={amountRef}
                type="number" inputMode="decimal" placeholder="0"
                step="0.01" min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="bg-transparent text-5xl font-bold outline-none placeholder:text-3 text-center w-[180px]"
                style={{ maxWidth: 'calc(100% - 56px)', minWidth: 80, color: '#f0eeff' }}
              />
            </div>
            {errors.amount && <p className="text-xs text-center pb-1" style={{ color: 'var(--expense)' }}>{errors.amount}</p>}
          </div>
        ) : (
          /* Normal mode: expense / income toggle + colored amount */
          <>
            <div className="flex gap-1.5 px-4 pt-3 pb-3">
              {(['expense', 'income'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={cn('flex-1 py-2 rounded-xl text-sm font-bold tap transition-all',
                    type === t
                      ? t === 'income' ? 'grad-income text-white shadow-lg' : 'grad-expense text-white shadow-lg'
                      : 'bg-card2 text-2'
                  )}>
                  {t === 'income' ? '↑ Income' : '↓ Expense'}
                </button>
              ))}
            </div>
            <div className="px-4 pb-1" style={{ background: accentBg }}>
              <div className="flex items-center justify-center gap-1 py-2">
                <span className="text-4xl font-bold" style={{ color: accentColor }}>{currencySymbol}</span>
                <input
                  ref={amountRef}
                  type="number" inputMode="decimal" placeholder="0"
                  step="0.01" min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="bg-transparent text-5xl font-bold text-1 outline-none placeholder:text-3 text-center w-[180px]"
                  style={{ maxWidth: 'calc(100% - 56px)', minWidth: 80 }}
                />
              </div>
              {errors.amount && <p className="text-xs text-center pb-1" style={{ color: 'var(--expense)' }}>{errors.amount}</p>}
            </div>
          </>
        )}

        {/* Description — same in both modes */}
        <div className="px-4 pb-2 pt-2">
          <input
            className="w-full bg-transparent text-sm text-center text-1 outline-none placeholder:text-3"
            placeholder={group ? 'e.g. Dinner, Hotel, Taxi…' : (type === 'income' ? 'e.g. Salary, Freelance…' : 'What was this for?')}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          {errors.notes && <p className="text-xs text-center mt-0.5" style={{ color: 'var(--expense)' }}>{errors.notes}</p>}

          {/* SMS parse pill — visible hint below description */}
          {!showSmsInput && (
            <div className="flex justify-center mt-1.5">
              <button
                type="button"
                onClick={handleClipboardPaste}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full tap"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
              >
                <Clipboard size={11} style={{ color: 'var(--text-3)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>Paste bank SMS to auto-fill</span>
              </button>
            </div>
          )}

          {showSmsInput && (
            <div className="mt-2 flex flex-col gap-1.5">
              <textarea
                className="input text-xs resize-none leading-relaxed"
                rows={3}
                placeholder="Paste your bank SMS here…"
                value={smsText}
                onChange={e => setSmsText(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowSmsInput(false); setSmsText('') }}
                  className="flex-1 py-1.5 rounded-xl text-xs text-3 tap"
                  style={{ background: 'var(--bg-card2)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => smsText.trim() && handleSmsParse(smsText)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold tap"
                  style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--brand)' }}
                >
                  Parse
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Scrollable body ─── */}
      <div className="px-4 pt-4 flex flex-col gap-4 pb-6">

        {/* Category — horizontal scroll, same in both modes */}
        {(group || type === 'expense') && (
          <div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {sortedCats.map(c => (
                <button key={c.id} onClick={() => { setCategoryId(c.id); setErrors(e => ({ ...e, categoryId: '' })) }}
                  className={cn('flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap transition-all',
                    categoryId === c.id ? '' : 'bg-card2'
                  )}
                  style={categoryId === c.id
                    ? { background: `${c.color}18`, outline: `1.5px solid ${c.color}55`, minWidth: 64 }
                    : { minWidth: 64 }}>
                  <span className="text-2xl leading-none">{c.icon}</span>
                  <span className="text-[10px] font-semibold text-2 truncate" style={{ maxWidth: 56, color: categoryId === c.id ? c.color : undefined }}>
                    {c.name.split(' ')[0]}
                  </span>
                </button>
              ))}
              {!showQuickAdd && (
                <button onClick={() => setShowQuickAdd(true)}
                  className="flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap bg-card2"
                  style={{ minWidth: 64 }}>
                  <span className="text-2xl leading-none text-brand">+</span>
                  <span className="text-[10px] font-semibold text-3">New</span>
                </button>
              )}
            </div>
            {errors.categoryId && <p className="text-xs mt-1" style={{ color: 'var(--expense)' }}>{errors.categoryId}</p>}

            {showQuickAdd && (
              <div className="mt-2 p-3 rounded-xl bg-card2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input placeholder="📦" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                    className="input w-12 text-center text-lg py-1.5" />
                  <input placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    className="input flex-1 text-sm py-1.5" onKeyDown={e => e.key === 'Enter' && handleQuickAddCategory()} />
                  <button onClick={() => setShowQuickAdd(false)} className="tap text-3 p-1"><X size={14} /></button>
                </div>
                <div className="flex items-center gap-2">
                  {QUICK_COLORS.map(c => (
                    <button key={c} onClick={() => setNewCatColor(c)}
                      className={cn('w-5 h-5 rounded-full tap shrink-0', newCatColor === c && 'ring-2 ring-offset-1 ring-white')}
                      style={{ backgroundColor: c }} />
                  ))}
                  <button onClick={handleQuickAddCategory} className="ml-auto btn btn-brand text-xs py-1 px-3 rounded-lg">Add</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date + Payment method row */}
        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative overflow-hidden"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <span className="text-sm shrink-0">📅</span>
            <span className="text-xs text-1 truncate flex-1 font-medium">
              {date ? format(new Date(date), 'MMM d, h:mm a') : 'Set date'}
            </span>
            <input
              type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              style={{ colorScheme: 'dark' }}
            />
          </label>

          {/* Payment method — not applicable for group expenses */}
          {!group && (
            <div className="flex-1">
              <Select
                options={PAYMENT_METHODS}
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              />
            </div>
          )}
        </div>

        {/* ─── Group mode: Paid By + Split ─── */}
        {group && (
          <>
            {/* Who paid */}
            <div>
              <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Who paid?</p>
              <div className="flex gap-2 flex-wrap">
                {group.members.map(m => (
                  <button key={m.id} onClick={() => setPaidBy(m.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl tap transition-all"
                    style={paidBy === m.id
                      ? { background: `${m.avatarColor}25`, border: `1.5px solid ${m.avatarColor}60` }
                      : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: m.avatarColor }}>
                      {m.name[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold"
                      style={{ color: paidBy === m.id ? m.avatarColor : 'var(--text-2)' }}>
                      {m.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Split type */}
            <div>
              <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Split</p>
              <div className="flex gap-2">
                {(['equal', 'custom'] as const).map(t => (
                  <button key={t} onClick={() => setSplitType(t)}
                    className={cn('flex-1 py-2.5 text-sm font-semibold rounded-xl tap transition-all',
                      splitType === t ? 'grad-brand text-white' : 'bg-card2 text-2')}>
                    {t === 'equal' ? '⚖ Equal' : '✏ Custom'}
                  </button>
                ))}
              </div>
              {splitType === 'equal' && group.members.length > 0 && amount && !isNaN(parseFloat(amount)) && (
                <p className="text-xs text-3 mt-1.5 text-center">
                  {currencySymbol}{(parseFloat(amount) / group.members.length).toFixed(2)} per person
                </p>
              )}
            </div>

            {/* Custom split inputs */}
            {splitType === 'custom' && (
              <div className="flex flex-col gap-2">
                {group.members.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: m.avatarColor }}>
                      {m.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-1 flex-1">{m.name}</span>
                    <input
                      type="number" placeholder="0.00"
                      value={customSplits[m.id] ?? ''}
                      onChange={e => setCustomSplits(s => ({ ...s, [m.id]: e.target.value }))}
                      className="input w-28 text-right"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Personal mode only: pill row + expandables ─── */}
        {!group && (
          <>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setIsRecurring(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
                style={pill(isRecurring)}>
                <RefreshCw size={12} />
                {isRecurring ? 'Recurring' : 'Once'}
              </button>

              <button onClick={() => setShowTags(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
                style={pill(showTags || selectedTagIds.length > 0)}>
                <Hash size={12} />
                {selectedTagIds.length > 0 ? `${selectedTagIds.length} Tag${selectedTagIds.length > 1 ? 's' : ''}` : 'Tags'}
              </button>

              <button onClick={() => receiptRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
                style={pill(!!receipt, '#00c896')}>
                <Camera size={12} />
                {receipt ? '✓ Receipt' : 'Receipt'}
              </button>

              {type === 'expense' && groups.length > 0 && (
                <button onClick={() => setShowSplit(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
                  style={pill(showSplit || !!splitGroupId)}>
                  👥
                  {splitGroupId ? (groups.find(g => g.id === splitGroupId)?.name ?? 'Split') : 'Split'}
                </button>
              )}

              <button onClick={() => setShowCurrency(v => !v)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
                style={pill(showCurrency || currency !== settings.defaultCurrency)}>
                <span className="font-bold">{currencySymbol}</span>
                {currency}
              </button>
            </div>

            {isRecurring && (
              <Select
                options={[
                  { value: 'daily', label: '🔁 Daily' },
                  { value: 'weekly', label: '🔁 Weekly' },
                  { value: 'monthly', label: '🔁 Monthly' },
                  { value: 'yearly', label: '🔁 Yearly' },
                ]}
                value={recurrenceInterval}
                onChange={e => setRecurrenceInterval(e.target.value as RecurrenceInterval)}
              />
            )}

            {showTags && (
              <div className="flex flex-col gap-2 p-3 rounded-2xl bg-card2">
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => {
                      const active = selectedTagIds.includes(tag.id)
                      return (
                        <button key={tag.id} onClick={() => toggleTag(tag.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tap transition-all"
                          style={active
                            ? { background: `${tag.color}22`, color: tag.color, border: `1.5px solid ${tag.color}55` }
                            : { background: 'var(--bg-card)', color: 'var(--text-3)', border: '1.5px solid var(--border)' }}>
                          <Hash size={9} />{tag.name}
                          {active && <X size={9} className="ml-0.5 opacity-70" />}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 rounded-xl px-3 py-2"
                    style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}>
                    <Hash size={12} className="text-3 shrink-0" />
                    <input className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3"
                      placeholder="Add tag…" value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }} />
                  </div>
                  {tagInput.trim() && (
                    <button onClick={handleAddTag}
                      className="w-8 h-8 flex items-center justify-center rounded-xl tap"
                      style={{ background: 'var(--brand)', color: '#fff' }}>
                      <Hash size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {showCurrency && (
              <Select
                options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} — ${c.name}` }))}
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              />
            )}

            {showSplit && type === 'expense' && groups.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
                  {groups.map(g => (
                    <button key={g.id}
                      onClick={() => {
                        setSplitGroupId(g.id === splitGroupId ? null : g.id)
                        setSplitPaidBy(g.members[0]?.id ?? '')
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 tap transition-all"
                      style={splitGroupId === g.id
                        ? { background: 'rgba(124,92,252,0.2)', border: '1.5px solid rgba(124,92,252,0.5)' }
                        : { background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}>
                      <div className="w-6 h-6 grad-brand rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-white">{g.name[0].toUpperCase()}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold" style={{ color: splitGroupId === g.id ? 'var(--brand)' : 'var(--text-1)' }}>{g.name}</p>
                        <p className="text-[10px] text-3">{g.members.length} members</p>
                      </div>
                    </button>
                  ))}
                </div>

                {splitGroupId && (() => {
                  const grp = groups.find(g => g.id === splitGroupId)!
                  return (
                    <div className="px-3 pb-3 border-t border-ui pt-3">
                      <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Who paid?</p>
                      <div className="flex gap-2 flex-wrap">
                        {grp.members.map(m => (
                          <button key={m.id} onClick={() => setSplitPaidBy(m.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl tap transition-all"
                            style={splitPaidBy === m.id
                              ? { background: `${m.avatarColor}25`, border: `1.5px solid ${m.avatarColor}60` }
                              : { background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}>
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: m.avatarColor }}>{m.name[0].toUpperCase()}</div>
                            <span className="text-xs font-semibold"
                              style={{ color: splitPaidBy === m.id ? m.avatarColor : 'var(--text-2)' }}>{m.name}</span>
                          </button>
                        ))}
                      </div>
                      {amount && !isNaN(parseFloat(amount)) && grp.members.length > 0 && (
                        <p className="text-[10px] text-3 mt-2">
                          Split equally · {CURRENCIES.find(c => c.code === grp.currency)?.symbol ?? ''}{(parseFloat(amount) / grp.members.length).toFixed(2)} per person
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Receipt */}
            <input ref={receiptRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
            {receipt && (
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img src={receipt} className="w-14 h-14 rounded-xl object-cover border border-ui" alt="Receipt" />
                  <button onClick={() => setReceipt(null)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--expense)' }}>
                    <X size={10} className="text-white" />
                  </button>
                </div>
                <p className="text-xs text-2">Receipt attached</p>
              </div>
            )}
          </>
        )}

        {/* ─── Save button ─── */}
        <button
          className="w-full py-4 rounded-2xl text-base font-bold text-white tap transition-all mt-1"
          style={{ background: gradBtn, boxShadow: '0 6px 20px rgba(124,92,252,0.3)', opacity: loading ? 0.7 : 1 }}
          onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : expense
            ? 'Update'
            : group
              ? `Add to ${group.name}`
              : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
        </button>
        <button className="text-sm text-3 tap text-center py-1" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
