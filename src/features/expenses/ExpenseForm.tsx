import { useState, useMemo, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { RefreshCw, Camera, Hash, AlertTriangle, Check, CalendarDays, Users } from 'lucide-react'
import { Select } from '@/components/ui/Input'
import { NumPad } from '@/components/ui/NumPad'
import { PaymentMethodIcon } from '@/components/ui/PaymentMethodIcon'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useGroupStore } from '@/store/useGroupStore'
import { toast } from '@/components/ui/Toast'
import type { Expense, Group, PaymentMethod, RecurrenceInterval, Tag } from '@/core/types'
import { PAYMENT_METHOD_LABELS, CURRENCIES } from '@/core/constants'
import { cn, formatCurrency } from '@/core/utils'
import { tagQueries, expenseQueries } from '@/db/queries'
import { parseSMS, merchantToNotes } from '@/core/smsParser'
import { nextOccurrence } from '@/services/recurringProcessor'
import { PAYMENT_METHODS, getRecentCatIds, saveRecentCatId, compressImage } from './expenseFormHelpers'
import { CategoryPicker } from './CategoryPicker'
import { TagPicker } from './TagPicker'
import { ReceiptPreview } from './ReceiptPreview'
import { SmsParseInput } from './SmsParseInput'
import { PaidBySplitRow } from './PaidBySplitRow'
import { SplitMemberCards } from './SplitMemberCards'

interface ExpenseFormProps {
  onClose: () => void
  expense?: Expense
  defaultType?: 'expense' | 'income'
  /** When set, renders in group-expense mode: group fields always visible, no personal entry saved */
  group?: Group
  /** Pre-fill values from share target or quick-add */
  prefill?: { amount?: number; notes?: string }
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
  const [nextDueDate, setNextDueDate] = useState(() => {
    const initial = expense?.recurrence?.nextDate ?? nextOccurrence(expense?.date ?? Date.now(), expense?.recurrence?.interval ?? 'monthly')
    return format(new Date(initial), 'yyyy-MM-dd')
  })
  const nextDueDateRef = useRef<HTMLInputElement>(null)
  const openNextDueDatePicker = () => {
    try { nextDueDateRef.current?.showPicker() } catch { nextDueDateRef.current?.click() }
  }
  const [receipt, setReceipt] = useState<string | null>(expense?.attachments?.[0] ?? null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [newCatColor, setNewCatColor] = useState('#7c5cfc')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateMatch, setDuplicateMatch] = useState<Expense | null>(null)
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
    toast.success(parsed.confidence === 'high' ? 'Parsed from SMS' : `Parsed · ${parsed.confidence} confidence`)
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

  const handleSubmit = async (opts?: { forceNonRecurring?: boolean; allowDuplicate?: boolean }) => {
    if (!validate()) return
    setLoading(true)
    try {
      const totalAmount = parseFloat(parseFloat(amount).toFixed(2))
      const effectiveIsRecurring = opts?.forceNonRecurring ? false : isRecurring

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
        toast.success(`Added to ${group.name}`)
        onClose()
        return
      }

      // ─── Duplicate-subscription guard ──────────────────────────────────
      // Only matters when this save would newly turn the expense recurring
      // (not when editing an already-recurring one's own details) — avoids
      // silently spawning a second "Netflix" template alongside an existing
      // one just because someone marked an old transaction as recurring.
      const becomingRecurring = effectiveIsRecurring && !expense?.isRecurring
      if (becomingRecurring && !opts?.allowDuplicate) {
        const trimmedName = notes.trim().toLowerCase()
        if (trimmedName) {
          const allRecurring = await expenseQueries.getRecurring()
          const match = allRecurring.find(r => r.id !== expense?.id && (r.notes ?? '').trim().toLowerCase() === trimmedName)
          if (match) {
            setDuplicateMatch(match)
            setLoading(false)
            return
          }
        }
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
        isRecurring: effectiveIsRecurring,
        recurrence: effectiveIsRecurring
          ? { interval: recurrenceInterval, nextDate: new Date(`${nextDueDate}T00:00:00`).getTime(), endDate: expense?.recurrence?.endDate }
          : undefined,
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
          toast.success(`${expense ? 'Updated & added to' : 'Added to'} ${grp.name}`)
        } else {
          toast.success(expense ? 'Updated' : 'Expense added')
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
        toast.success(expense ? 'Updated' : (type === 'income' ? 'Income added' : 'Expense added'))
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

          <SmsParseInput
            showInput={showSmsInput}
            onTriggerPaste={handleClipboardPaste}
            smsText={smsText}
            onSmsTextChange={setSmsText}
            onCancel={() => { setShowSmsInput(false); setSmsText('') }}
            onParse={() => handleSmsParse(smsText)}
          />
        </div>
      </div>

      {/* ─── Scrollable body ─── */}
      <div className="px-4 pt-4 flex flex-col gap-4 pb-6">

        {/* Category — horizontal scroll, same in both modes */}
        {(group || type === 'expense') && (
          <CategoryPicker
            categories={sortedCats}
            categoryId={categoryId}
            onSelect={id => { setCategoryId(id); setErrors(e => ({ ...e, categoryId: '' })) }}
            error={errors.categoryId}
            showQuickAdd={showQuickAdd}
            onToggleQuickAdd={setShowQuickAdd}
            newCatName={newCatName}
            onNewCatNameChange={setNewCatName}
            newCatIcon={newCatIcon}
            onNewCatIconChange={setNewCatIcon}
            newCatColor={newCatColor}
            onNewCatColorChange={setNewCatColor}
            onQuickAddSubmit={handleQuickAddCategory}
          />
        )}

        {/* Date + Payment method row */}
        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative overflow-hidden"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <CalendarDays size={14} className="shrink-0 text-3" />
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
            <PaidBySplitRow
              members={group.members}
              paidBy={paidBy}
              onPaidByChange={setPaidBy}
              splitType={splitType}
              onSplitTypeChange={setSplitType}
            />

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
                {splitGroupId ? <Check size={12} /> : <Users size={12} />}
                {splitGroupId ? (groups.find(g => g.id === splitGroupId)?.name ?? 'Group') : 'Add to Group'}
              </button>
            )}
          </div>
        )}

        {!group && isRecurring && (
          <Select
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
            value={recurrenceInterval}
            onChange={e => setRecurrenceInterval(e.target.value as RecurrenceInterval)}
          />
        )}

        {!group && isRecurring && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
            onClick={openNextDueDatePicker}>
            <span className="text-sm shrink-0">⏭️</span>
            <div className="flex-1">
              <p className="text-[10px] text-3 font-semibold uppercase tracking-wide">Next due date</p>
              <p className="text-xs text-1 font-medium">{format(new Date(nextDueDate), 'MMM d, yyyy')}</p>
            </div>
            <input
              ref={nextDueDateRef} type="date" value={nextDueDate}
              onChange={e => setNextDueDate(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              style={{ colorScheme: 'dark' }}
            />
          </div>
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
                    <div className="mx-3 mt-3 px-3 py-2 rounded-xl text-[11px] leading-relaxed flex items-start gap-1.5"
                      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.9)' }}>
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>This group uses {grpSym} {grp.currency} but your expense is in {currencySymbol} {currency}. The amount will be recorded as-is in {grp.currency}. Change the group's currency in Group Settings if needed.</span>
                    </div>
                  )}
                  <div className="px-3 pt-2 pb-2">
                    <PaidBySplitRow
                      members={grp.members}
                      paidBy={splitPaidBy}
                      onPaidByChange={setSplitPaidBy}
                      splitType={personalSplitType}
                      onSplitTypeChange={setPersonalSplitType}
                      memberBg="var(--bg-card)"
                    />
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
            {receipt ? <Check size={12} /> : <Camera size={12} />}
            Receipt
          </button>

          <button onClick={() => setShowPaymentMethod(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
            style={pill(showPaymentMethod)}>
            <PaymentMethodIcon method={paymentMethod} />
            {PAYMENT_METHOD_LABELS[paymentMethod]}
          </button>
        </div>

        {showTags && (
          <TagPicker
            allTags={allTags}
            selectedTagIds={selectedTagIds}
            onToggleTag={toggleTag}
            tagInput={tagInput}
            onTagInputChange={setTagInput}
            onAddTag={handleAddTag}
          />
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
                <PaymentMethodIcon method={pm.value} />
                {pm.label}
              </button>
            ))}
          </div>
        )}

        {/* Receipt */}
        <input ref={receiptRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
        {receipt && (
          <ReceiptPreview
            receipt={receipt}
            onRemove={() => setReceipt(null)}
            currencySymbol={currencySymbol}
            categories={categories}
            onDetailsExtracted={({ amount: amt, merchant, categoryId: catId }) => {
              if (amt != null) setAmount(amt.toString())
              // Only fill in fields the user hasn't already touched — never clobber manual entry.
              if (merchant && !notes.trim()) setNotes(merchant)
              if (catId && !categoryId) setCategoryId(catId)
            }}
          />
        )}

        {/* ─── Duplicate-subscription warning ─── */}
        {duplicateMatch && (
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <p className="text-sm text-1">
                You already have a subscription called <span className="font-semibold">"{duplicateMatch.notes}"</span> for{' '}
                {formatCurrency(duplicateMatch.amount, duplicateMatch.currency, settings.showCents)}/{duplicateMatch.recurrence?.interval ?? 'monthly'}.
                Creating another will show up as a duplicate in your Subscriptions list.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="w-full py-3 rounded-xl text-sm font-bold text-white tap"
                style={{ background: gradBtn }}
                onClick={() => handleSubmit({ forceNonRecurring: true })} disabled={loading}>
                Save as one-time (don't duplicate)
              </button>
              <button
                className="w-full py-3 rounded-xl text-sm font-semibold tap"
                style={{ background: 'var(--bg-card2)', color: 'var(--text-2)' }}
                onClick={() => handleSubmit({ allowDuplicate: true })} disabled={loading}>
                Create separate subscription anyway
              </button>
              <button className="text-sm text-3 tap text-center py-1" onClick={() => setDuplicateMatch(null)}>Go back</button>
            </div>
          </div>
        )}

        {/* ─── Save button ─── */}
        {!duplicateMatch && (
          <>
            <button
              className="w-full py-4 rounded-2xl text-base font-bold text-white tap transition-all mt-1"
              style={{ background: gradBtn, boxShadow: '0 6px 20px rgba(124,92,252,0.3)', opacity: loading ? 0.7 : 1 }}
              onClick={() => handleSubmit()} disabled={loading}>
              {loading ? 'Saving…' : expense
                ? 'Update'
                : group
                  ? `Add to ${group.name}`
                  : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
            </button>
            <button className="text-sm text-3 tap text-center py-1" onClick={onClose}>Cancel</button>
          </>
        )}
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
