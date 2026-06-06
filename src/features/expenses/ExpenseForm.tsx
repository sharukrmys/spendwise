import { useState, useMemo, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { RefreshCw, Camera, X, Hash, Clipboard } from 'lucide-react'
import { Select } from '@/components/ui/Input'
import { NumPad } from '@/components/ui/NumPad'
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
  const { groups, addGroupExpense, updateGroupExpense, load: loadGroups } = useGroupStore()

  const [type, setType] = useState<'expense' | 'income'>(expense?.type ?? defaultType)
  const [amount, setAmount] = useState(expense?.amount?.toString() ?? prefill?.amount?.toString() ?? '')
  // Group mode: currency is fixed to the group's currency. Trip mode: default to trip currency.
  const defaultCurrency = group ? group.currency : (settings.tripMode && settings.tripCurrency ? settings.tripCurrency : settings.defaultCurrency)
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency)
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
  const [showSplit, setShowSplit] = useState(!!expense?.groupId)
  const [showCurrency, setShowCurrency] = useState(false)
  const [showPaymentMethod, setShowPaymentMethod] = useState(false)

  // Tags
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(expense?.tags ?? [])
  const [tagInput, setTagInput] = useState('')

  // Personal-expense group split
  const [splitGroupId, setSplitGroupId] = useState<string | null>(expense?.groupId ?? null)
  const [splitPaidBy, setSplitPaidBy] = useState<string>('')
  const [personalSplitType, setPersonalSplitType] = useState<'equal' | 'custom'>('equal')
  const [personalCustomSplits, setPersonalCustomSplits] = useState<Record<string, string>>({})
  const [personalIgnoredSplitMembers, setPersonalIgnoredSplitMembers] = useState<Set<string>>(new Set())

  // Group mode: paid-by + split (always shown when group prop is set)
  const [paidBy, setPaidBy] = useState(group?.members[0]?.id ?? '')
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})
  const [ignoredSplitMembers, setIgnoredSplitMembers] = useState<Set<string>>(new Set())

  const [showSmsInput, setShowSmsInput] = useState(false)
  const [smsText, setSmsText] = useState('')
  const [showNumPad, setShowNumPad] = useState(false)

  const receiptRef = useRef<HTMLInputElement>(null)

  // Scroll focused inputs into view when the soft keyboard opens
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const el = e.currentTarget
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 320)
  }

  useEffect(() => { tagQueries.getAll().then(setAllTags) }, [])
  useEffect(() => { setTimeout(() => setShowNumPad(true), 120) }, [])
  useEffect(() => { loadGroups() }, [])

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

  const toggleIgnoreSplitMember = (id: string) =>
    setIgnoredSplitMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id); setCustomSplits(s => ({ ...s, [id]: '0' })) }
      return next
    })

  const togglePersonalIgnoreMember = (id: string) =>
    setPersonalIgnoredSplitMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id); setPersonalCustomSplits(s => ({ ...s, [id]: '0' })) }
      return next
    })

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
        const activeMembers = group.members.filter(m => !ignoredSplitMembers.has(m.id))
        const splits = group.members.map(m => {
          const ignored = ignoredSplitMembers.has(m.id)
          const splitAmount = ignored ? 0 : splitType === 'equal'
            ? parseFloat((totalAmount / (activeMembers.length || 1)).toFixed(2))
            : parseFloat(customSplits[m.id] ?? '0')
          return { memberId: m.id, amount: splitAmount, settled: m.id === paidBy && !ignored }
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
          paymentMethod,
          tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
          attachments: receipt ? [receipt] : undefined,
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
        groupId: splitGroupId || undefined,
      }
      if (data.categoryId) saveRecentCatId(data.categoryId)
      let savedExpenseId: string
      if (expense) {
        await updateExpense(expense.id, data)
        savedExpenseId = expense.id
      } else {
        const saved = await addExpense(data)
        savedExpenseId = saved.id
      }
      // Add to group for new expenses OR when the group selection changes on edit
      const shouldAddToGroup = splitGroupId && type === 'expense' && (!expense || splitGroupId !== expense.groupId)
      if (shouldAddToGroup) {
        const grp = groups.find(g => g.id === splitGroupId)
        if (grp && grp.members.length > 0) {
          const paidById = splitPaidBy || grp.members[0].id
          const activeMembers = grp.members.filter(m => !personalIgnoredSplitMembers.has(m.id))
          const newGE = await addGroupExpense({
            groupId: grp.id,
            description: notes.trim() || 'Expense',
            amount: totalAmount,
            currency: grp.currency,
            paidBy: paidById,
            categoryId: data.categoryId || undefined,
            splits: grp.members.map(m => {
              const ignored = personalIgnoredSplitMembers.has(m.id)
              const splitAmt = ignored ? 0 : personalSplitType === 'equal'
                ? parseFloat((totalAmount / (activeMembers.length || 1)).toFixed(2))
                : parseFloat(personalCustomSplits[m.id] ?? '0')
              return { memberId: m.id, amount: splitAmt, settled: m.id === paidById && !ignored }
            }),
            date: data.date,
            notes: notes.trim() || undefined,
          })
          // Store back-reference so future edits keep both records in sync
          await updateExpense(savedExpenseId, { linkedGroupExpenseId: newGE.id })
          toast.success(`${expense ? 'Updated & added to' : 'Added to'} ${grp.name}!`)
        } else {
          toast.success(expense ? 'Updated' : 'Expense added!')
        }
      } else if (expense?.linkedGroupExpenseId && expense.groupId && splitGroupId === expense.groupId) {
        // Group unchanged on edit — keep GroupExpense.description in sync with personal expense notes
        await updateGroupExpense(expense.groupId, expense.linkedGroupExpenseId, {
          description: notes.trim() || 'Expense',
          amount: totalAmount,
          date: data.date,
          categoryId: data.categoryId || undefined,
        })
        toast.success('Updated')
      } else {
        toast.success(expense ? 'Updated' : (type === 'income' ? 'Income added!' : 'Expense added!'))
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
            <button
              type="button"
              onClick={() => setShowNumPad(true)}
              className="flex items-center justify-center gap-1 py-1 tap w-full"
            >
              <span className="text-4xl font-bold" style={{ color: 'rgba(200,195,240,0.5)' }}>{currencySymbol}</span>
              <span className="text-5xl font-bold" style={{ color: amount ? '#f0eeff' : 'rgba(200,195,240,0.3)', minWidth: 80, textAlign: 'center' }}>
                {amount || '0'}
              </span>
            </button>
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
                <button
                  type="button"
                  onClick={() => setShowCurrency(v => !v)}
                  className="text-4xl font-bold tap shrink-0"
                  style={{ color: accentColor, background: 'transparent', border: 'none', padding: 0, opacity: showCurrency ? 1 : 0.85 }}
                >
                  {currencySymbol}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNumPad(true)}
                  className="text-5xl font-bold outline-none text-center tap"
                  style={{ minWidth: 80, color: amount ? 'var(--text)' : 'var(--text-3)', background: 'transparent', border: 'none' }}
                >
                  {amount || '0'}
                </button>
              </div>
              {errors.amount && <p className="text-xs text-center pb-1" style={{ color: 'var(--expense)' }}>{errors.amount}</p>}
              {/* Currency selector — drops inline below amount when symbol tapped */}
              {showCurrency && (
                <div className="px-2 pb-2">
                  <Select
                    options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} — ${c.name}` }))}
                    value={currency}
                    onChange={e => { setCurrency(e.target.value); setShowCurrency(false) }}
                  />
                </div>
              )}
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
            onFocus={handleInputFocus}
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
        </div>

        {/* ─── Group mode: Paid By + Split ─── */}
        {group && (
          <>
            {/* Who paid + Split type in one compact row */}
            <div className="flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-1.5">Who paid?</p>
                <div className="flex gap-1.5 flex-wrap">
                  {group.members.map(m => (
                    <button key={m.id} onClick={() => setPaidBy(m.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl tap transition-all"
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
              <div className="shrink-0">
                <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-1.5">Split</p>
                <div className="flex gap-1.5">
                  {(['equal', 'custom'] as const).map(t => (
                    <button key={t} onClick={() => setSplitType(t)}
                      className={cn('px-3 py-1.5 text-xs font-semibold rounded-xl tap transition-all',
                        splitType === t ? 'grad-brand text-white' : 'bg-card2 text-2')}>
                      {t === 'equal' ? '⚖️ Equal' : '✏️ Custom'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Split member cards — shared design for both equal & custom */}
            <SplitMemberCards
              members={group.members}
              splitType={splitType}
              amount={amount}
              currencySymbol={currencySymbol}
              ignoredMembers={ignoredSplitMembers}
              customSplits={customSplits}
              onToggleIgnore={toggleIgnoreSplitMember}
              onCustomChange={(id, val) => setCustomSplits(s => ({ ...s, [id]: val }))}
            />
          </>
        )}

        {/* ─── Personal-only pills: Recurring + Add to Group ─── */}
        {!group && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setIsRecurring(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
              style={pill(isRecurring)}>
              <RefreshCw size={12} />
              {isRecurring ? 'Recurring' : 'Once'}
            </button>

            {type === 'expense' && groups.length > 0 && (
              <button onClick={() => setShowSplit(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
                style={pill(showSplit || !!splitGroupId)}>
                👥
                {splitGroupId ? `✓ ${groups.find(g => g.id === splitGroupId)?.name ?? 'Group'}` : 'Add to Group'}
              </button>
            )}
          </div>
        )}

        {!group && isRecurring && (
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

        {!group && showSplit && type === 'expense' && groups.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            {/* Group picker */}
            <div className="flex gap-2 px-3 pt-2 pb-2 overflow-x-auto no-scrollbar">
              {groups.map(g => (
                <button key={g.id}
                  onClick={() => {
                    const selecting = g.id !== splitGroupId
                    setSplitGroupId(selecting ? g.id : null)
                    setSplitPaidBy(g.members[0]?.id ?? '')
                    setPersonalSplitType('equal')
                    setPersonalCustomSplits({})
                    setPersonalIgnoredSplitMembers(new Set())
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
              const grpSym = CURRENCIES.find(c => c.code === grp.currency)?.symbol ?? grp.currency[0]
              const hasCurrencyMismatch = grp.currency !== currency
              return (
                <div className="border-t border-ui">
                  {/* Currency mismatch warning */}
                  {hasCurrencyMismatch && (
                    <div className="mx-3 mt-3 px-3 py-2 rounded-xl text-[11px] leading-relaxed"
                      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.9)' }}>
                      ⚠️ This group uses {grpSym} {grp.currency} but your expense is in {currencySymbol} {currency}. The amount will be recorded as-is in {grp.currency}. Change the group's currency in Group Settings if needed.
                    </div>
                  )}
                  {/* Who paid + Split type in one compact row */}
                  <div className="px-3 pt-2 pb-2 flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-1.5">Who paid?</p>
                      <div className="flex gap-1.5 flex-wrap">
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
                    </div>
                    <div className="shrink-0">
                      <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-1.5">Split</p>
                      <div className="flex gap-1.5">
                        {(['equal', 'custom'] as const).map(t => (
                          <button key={t} onClick={() => setPersonalSplitType(t)}
                            className={cn('px-3 py-1.5 text-xs font-semibold rounded-xl tap transition-all',
                              personalSplitType === t ? 'grad-brand text-white' : 'bg-card2 text-2')}>
                            {t === 'equal' ? '⚖️ Equal' : '✏️ Custom'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Member split cards */}
                  <div className="border-t border-ui px-3 pt-2 pb-2">
                    <SplitMemberCards
                      members={grp.members}
                      splitType={personalSplitType}
                      amount={amount}
                      currencySymbol={grpSym}
                      ignoredMembers={personalIgnoredSplitMembers}
                      customSplits={personalCustomSplits}
                      onToggleIgnore={togglePersonalIgnoreMember}
                      onCustomChange={(id, val) => setPersonalCustomSplits(s => ({ ...s, [id]: val }))}
                    />
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ─── Tags, Receipt, Payment Method — shown in both personal and group mode ─── */}
        <div className="flex gap-2 flex-wrap">
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

          <button onClick={() => setShowPaymentMethod(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
            style={pill(showPaymentMethod)}>
            <span>{PAYMENT_METHOD_ICONS[paymentMethod]}</span>
            {PAYMENT_METHOD_LABELS[paymentMethod]}
          </button>
        </div>

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

        {showPaymentMethod && (
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map(pm => (
              <button key={pm.value}
                onClick={() => { setPaymentMethod(pm.value as PaymentMethod); setShowPaymentMethod(false) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl tap transition-all text-xs font-semibold"
                style={paymentMethod === pm.value
                  ? { background: 'rgba(124,92,252,0.2)', border: '1.5px solid rgba(124,92,252,0.5)', color: 'var(--brand)' }
                  : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}>
                {pm.label}
              </button>
            ))}
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
            <div className="flex-1 min-w-0">
              <p className="text-xs text-2 mb-1.5">Receipt attached</p>
              {'TextDetector' in window && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const img = new Image()
                      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = receipt })
                      const bitmap = await createImageBitmap(img)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const detector = new (window as any).TextDetector()
                      const results: Array<{ rawValue: string }> = await detector.detect(bitmap)
                      const text = results.map(r => r.rawValue).join(' ')
                      // Look for currency amount patterns: ₹1,234.56 / $12.50 / 1234
                      const match = text.match(/(?:₹|Rs\.?|INR|USD|\$|€|£)?\s*([\d,]+(?:\.\d{1,2})?)/i)
                      if (match) {
                        const parsed = parseFloat(match[1].replace(/,/g, ''))
                        if (!isNaN(parsed) && parsed > 0) {
                          setAmount(parsed.toString())
                          toast.success(`Amount extracted: ${currencySymbol}${parsed}`)
                        } else {
                          toast.error('No amount found in receipt')
                        }
                      } else {
                        toast.error('No amount found in receipt')
                      }
                    } catch {
                      toast.error('OCR failed — try again')
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl tap text-xs font-semibold"
                  style={{ background: 'rgba(124,92,252,0.12)', color: 'var(--brand)', border: '1px solid rgba(124,92,252,0.25)' }}
                >
                  ✨ Extract amount
                </button>
              )}
            </div>
          </div>
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

      {/* NumPad overlay */}
      {showNumPad && (
        <NumPad
          value={amount}
          onChange={setAmount}
          onConfirm={() => setShowNumPad(false)}
          onClose={() => setShowNumPad(false)}
          currencySymbol={currencySymbol}
          label={group ? `${group.name} · ${group.currency}` : (type === 'income' ? 'Income amount' : 'Expense amount')}
        />
      )}
    </div>
  )
}

// ─── Split Member Cards ───────────────────────────────────────────────
export function SplitMemberCards({
  members, splitType, amount, currencySymbol,
  ignoredMembers, customSplits, onToggleIgnore, onCustomChange,
}: {
  members: Group['members']
  splitType: 'equal' | 'custom'
  amount: string
  currencySymbol: string
  ignoredMembers: Set<string>
  customSplits: Record<string, string>
  onToggleIgnore: (id: string) => void
  onCustomChange: (id: string, val: string) => void
}) {
  const total = parseFloat(amount) || 0
  const activeMembers = members.filter(m => !ignoredMembers.has(m.id))
  // Floor-based equal split: remainder (rounding) goes to first active member
  const base = activeMembers.length > 0 && total > 0
    ? Math.floor((total / activeMembers.length) * 100) / 100
    : 0
  const roundRem = activeMembers.length > 0 && total > 0
    ? parseFloat((total - base * activeMembers.length).toFixed(2))
    : 0
  const getEqualAmt = (id: string) => {
    if (ignoredMembers.has(id)) return 0
    return activeMembers[0]?.id === id ? base + roundRem : base
  }

  const customSum = members
    .filter(m => !ignoredMembers.has(m.id))
    .reduce((s, m) => s + (parseFloat(customSplits[m.id] ?? '0') || 0), 0)
  const remaining = total - customSum
  const pct = total > 0 ? Math.min(100, (customSum / total) * 100) : 0
  // Only warn when difference >= 1 unit; ignore sub-unit rounding
  const ok = Math.abs(remaining) < 1

  return (
    <div className="flex flex-col gap-2">
      {members.map(m => {
        const ignored = ignoredMembers.has(m.id)
        return (
          <div key={m.id}
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: ignored ? 'rgba(255,255,255,0.02)' : 'var(--bg-card2)',
              border: `1.5px solid ${ignored ? 'rgba(255,255,255,0.06)' : 'var(--border)'}`,
              opacity: ignored ? 0.5 : 1,
            }}>
            {/* Header: avatar + name + amount (equal) + exclude */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: ignored ? '#666' : m.avatarColor }}>
                {m.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold truncate', ignored ? 'text-3 line-through' : 'text-1')}>
                  {m.name}
                </p>
                {splitType === 'equal' && !ignored && total > 0 && (
                  <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--brand)' }}>
                    {currencySymbol}{getEqualAmt(m.id).toFixed(2)}
                  </p>
                )}
                {ignored && <p className="text-[10px] text-3 mt-0.5">Not in this split</p>}
              </div>
              <button
                onClick={() => onToggleIgnore(m.id)}
                className="px-2.5 py-1.5 rounded-xl tap text-[11px] font-bold shrink-0 transition-all"
                style={ignored
                  ? { background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.3)' }
                  : { background: 'rgba(255,107,107,0.08)', color: 'rgba(255,107,107,0.8)', border: '1px solid rgba(255,107,107,0.2)' }}>
                {ignored ? '+ Include' : '× Exclude'}
              </button>
            </div>
            {/* Custom amount input — full width below header */}
            {splitType === 'custom' && !ignored && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,92,252,0.1), rgba(168,85,247,0.06))',
                    border: '1.5px solid rgba(124,92,252,0.2)',
                  }}>
                  <span className="text-lg font-bold shrink-0" style={{ color: 'rgba(124,92,252,0.6)' }}>
                    {currencySymbol}
                  </span>
                  <input
                    type="number" inputMode="decimal" placeholder="0.00"
                    value={customSplits[m.id] ?? ''}
                    onChange={e => onCustomChange(m.id, e.target.value)}
                    className="flex-1 bg-transparent text-xl font-bold text-1 text-right outline-none placeholder:text-3 min-w-0"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Distribution summary — custom mode, informational only */}
      {splitType === 'custom' && total > 0 && (
        <div className="rounded-2xl px-4 py-3"
          style={{ background: 'var(--bg-card2)', border: '1.5px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-3">Distributed</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tabular-nums" style={{ color: ok ? '#00c896' : 'var(--text-1)' }}>
                {currencySymbol}{customSum.toFixed(2)}
              </span>
              <span className="text-xs text-3">of {currencySymbol}{total.toFixed(2)}</span>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: ok ? '#00c896' : remaining > 0 ? 'linear-gradient(90deg,#7c5cfc,#a855f7)' : '#ef4444' }} />
          </div>
          {!ok && (
            <p className="text-[11px] text-center mt-2 font-medium"
              style={{ color: remaining > 0 ? 'var(--text-3)' : 'var(--expense)' }}>
              {remaining > 0
                ? `${currencySymbol}${remaining.toFixed(2)} remaining`
                : `${currencySymbol}${Math.abs(remaining).toFixed(2)} over`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
