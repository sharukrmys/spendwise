import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { X, MapPin, RefreshCw, GripVertical, ChevronDown, ChevronUp, ArrowRight, CalendarDays, StickyNote, Check, ListChecks, ShoppingCart, Settings } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import { Select } from '@/components/ui/Input'
import { useTaskStore } from '@/store/useTaskStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { toast } from '@/components/ui/Toast'
import { CURRENCIES } from '@/core/constants'
import { generateId, cn } from '@/core/utils'
import type { Task, TaskType, TaskPriority, RecurrenceInterval, ChecklistItem } from '@/core/types'

interface TaskFormProps {
  onClose: () => void
  task?: Task
  defaultType?: TaskType
}

const PRIORITY_CONFIG: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#8480a8' },
  { value: 'medium', label: 'Med', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ff6b6b' },
]

const QUICK_COLORS = ['#7c5cfc', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#ef4444', '#f97316', '#8b5cf6']

// Scroll the nearest overflow-y-auto ancestor to bring `el` into view
function scrollIntoScrollContainer(el: HTMLElement | null) {
  if (!el) return
  let parent = el.parentElement
  while (parent) {
    const { overflow, overflowY } = window.getComputedStyle(parent)
    if (/auto|scroll/.test(overflow) || /auto|scroll/.test(overflowY)) {
      const elRect = el.getBoundingClientRect()
      const containerRect = parent.getBoundingClientRect()
      const overBottom = elRect.bottom - containerRect.bottom + 16
      const overTop = containerRect.top - elRect.top + 16
      if (overBottom > 0) parent.scrollBy({ top: overBottom, behavior: 'smooth' })
      else if (overTop > 0) parent.scrollBy({ top: -overTop, behavior: 'smooth' })
      return
    }
    parent = parent.parentElement
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function ChecklistItemRow({ item, shoppingMode, currencySymbol, onUpdate, onRemove }: {
  item: ChecklistItem
  shoppingMode: boolean
  currencySymbol: string
  onUpdate: (id: string, patch: Partial<ChecklistItem>) => void
  onRemove: (id: string) => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} style={{ listStyle: 'none' }}>
      <div className="flex items-center gap-2 rounded-xl px-2.5 py-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
        <GripVertical size={13} className="text-3 shrink-0 cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} onPointerDown={e => controls.start(e)} />
        <input
          className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3 min-w-0"
          placeholder="Item name"
          value={item.name}
          onChange={e => onUpdate(item.id, { name: e.target.value })}
        />
        {shoppingMode && (
          <>
            <input
              type="number" inputMode="numeric"
              className="bg-transparent text-xs text-2 outline-none text-center shrink-0 rounded px-1"
              style={{ width: 36, background: 'var(--bg-card3)' }}
              placeholder="qty" min="1"
              value={item.quantity ?? ''}
              onChange={e => onUpdate(item.id, { quantity: e.target.value ? parseInt(e.target.value) : undefined })}
            />
            <div className="flex items-center shrink-0 rounded px-1" style={{ background: 'var(--bg-card3)' }}>
              <span className="text-[10px] text-3">{currencySymbol}</span>
              <input
                type="number" inputMode="decimal"
                className="bg-transparent text-xs text-1 outline-none text-right shrink-0"
                style={{ width: 44 }}
                placeholder="0" min="0" step="0.01"
                value={item.estimatedPrice ?? ''}
                onChange={e => onUpdate(item.id, { estimatedPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </>
        )}
        <button type="button" onClick={() => onRemove(item.id)} className="tap text-3 shrink-0 p-0.5"><X size={13} /></button>
      </div>
    </Reorder.Item>
  )
}

export function TaskForm({ onClose, task, defaultType = 'todo' }: TaskFormProps) {
  const { addTask, updateTask, load } = useTaskStore()
  const { categories, addCategory } = useCategoryStore()
  const { settings } = useSettingsStore()

  const [type, setType] = useState<TaskType>(task?.type ?? defaultType)
  const [title, setTitle] = useState(task?.title ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [dueDatetime, setDueDatetime] = useState(
    task?.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : ''
  )
  const [location, setLocation] = useState(task?.location ?? '')
  const [amount, setAmount] = useState(task?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState(task?.currency ?? settings.defaultCurrency)
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? '')
  const [isRecurring, setIsRecurring] = useState(task?.isRecurring ?? false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval>(task?.recurrence?.interval ?? 'weekly')
  const [showCurrency, setShowCurrency] = useState(false)
  const [showLocation, setShowLocation] = useState(!!task?.location)
  const [showNotes, setShowNotes] = useState(!!task?.notes)

  // Checklist
  const [items, setItems] = useState<ChecklistItem[]>(task?.items ?? [])
  const [shoppingMode, setShoppingMode] = useState(
    () => task?.items ? task.items.some(i => i.quantity != null || i.estimatedPrice != null) : false
  )
  const [newItemName, setNewItemName] = useState('')
  const [newItemQty, setNewItemQty] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [showOptions, setShowOptions] = useState(!!(task?.dueDate || task?.categoryId || task?.priority !== 'medium'))

  const newItemRef = useRef<HTMLInputElement>(null)
  const newQtyRef = useRef<HTMLInputElement>(null)
  const addItemRowRef = useRef<HTMLDivElement>(null)

  // Quick-add category
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [newCatColor, setNewCatColor] = useState(QUICK_COLORS[0])

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const titleRef = useRef<HTMLInputElement>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 80) }, [])

  const openDatePicker = () => {
    try { dueDateRef.current?.showPicker() } catch { dueDateRef.current?.click() }
  }

  const parentCategories = categories.filter(c => !c.parentId)

  const checklistTotal = items.reduce((s, i) => s + (i.estimatedPrice ?? 0) * (i.quantity ?? 1), 0)
  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency[0]

  // Called directly from button onClick — keeps keyboard open on iOS
  const handleAddItem = () => {
    const name = newItemName.trim()
    if (!name) return
    const qty = newItemQty ? parseInt(newItemQty) : undefined
    const price = newItemPrice ? parseFloat(newItemPrice) : undefined
    setItems(prev => [...prev, { id: generateId(), name, checked: false, quantity: qty, estimatedPrice: price }])
    setNewItemName('')
    setNewItemQty('')
    setNewItemPrice('')
    // Synchronous focus — stays in the same event stack, keyboard stays open on iOS
    newItemRef.current?.focus()
    setTimeout(() => scrollIntoScrollContainer(addItemRowRef.current), 60)
  }

  const updateItem = (id: string, patch: Partial<ChecklistItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id))

  const handleQuickAddCategory = async () => {
    if (!newCatName.trim()) return
    const newCat = await addCategory({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor, isDefault: false })
    setCategoryId(newCat.id)
    setNewCatName('')
    setNewCatIcon('📦')
    setShowQuickAdd(false)
    toast.success('Category added')
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Enter a title'
    if (type === 'checklist' && items.length === 0) errs.items = 'Add at least one item'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const dueDateTs = dueDatetime ? new Date(dueDatetime).getTime() : undefined
      const dueTimeStr = dueDatetime ? format(new Date(dueDatetime), 'HH:mm') : undefined
      const data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
        type, title: title.trim(), priority,
        status: task?.status ?? 'pending',
        notes: notes.trim() || undefined,
        dueDate: dueDateTs, dueTime: dueTimeStr,
        location: location.trim() || undefined,
        amount: amount && parseFloat(amount) > 0 ? parseFloat(amount) : undefined,
        currency,
        categoryId: categoryId || undefined,
        items: type === 'checklist' ? items : undefined,
        isRecurring,
        recurrence: isRecurring ? { interval: recurrenceInterval } : undefined,
        convertedExpenseId: task?.convertedExpenseId,
      }
      if (task) { await updateTask(task.id, data); toast.success('Task updated') }
      else { await addTask(data); toast.success(type === 'checklist' ? 'Checklist created' : 'Task added') }
      await load()
      onClose()
    } catch { toast.error('Failed to save task') }
    finally { setLoading(false) }
  }

  const pill = (active: boolean, color = '#7c5cfc') => active
    ? { background: `${color}18`, border: `1.5px solid ${color}45`, color }
    : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-3)' } as React.CSSProperties

  // ─── Options panel (shared between todo + checklist) ─────────────────────
  const OptionsPanel = () => (
    <div className="flex flex-col gap-3">
      {/* Priority */}
      <div>
        <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Priority</p>
        <div className="flex gap-2">
          {PRIORITY_CONFIG.map(p => (
            <button key={p.value} type="button" onClick={() => setPriority(p.value)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl tap transition-all text-xs font-semibold"
              style={priority === p.value
                ? { background: `${p.color}18`, border: `1.5px solid ${p.color}55`, color: p.color }
                : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-3)' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Due date */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative"
        style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
        onClick={openDatePicker}>
        <CalendarDays size={14} className="shrink-0 text-3" />
        <span className="text-xs text-1 truncate flex-1 font-medium">
          {dueDatetime ? format(new Date(dueDatetime), 'MMM d, yyyy · h:mm a') : 'Due date & time (optional)'}
        </span>
        <input ref={dueDateRef} type="datetime-local" value={dueDatetime}
          onChange={e => setDueDatetime(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          style={{ colorScheme: 'dark' }} />
        {dueDatetime && (
          <button type="button" className="relative z-10 tap text-3 shrink-0 p-0.5"
            onClick={e => { e.stopPropagation(); setDueDatetime('') }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Category</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button type="button" onClick={() => setCategoryId('')}
            className={cn('flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap transition-all', !categoryId ? 'bg-card3' : 'bg-card2')}
            style={{ minWidth: 56, ...(!categoryId ? { outline: '1.5px solid rgba(124,92,252,0.4)' } : {}) }}>
            <span className="text-2xl leading-none">✨</span>
            <span className="text-[10px] font-semibold text-2">None</span>
          </button>
          {parentCategories.map(c => (
            <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}
              className={cn('flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap transition-all', categoryId === c.id ? '' : 'bg-card2')}
              style={categoryId === c.id ? { background: `${c.color}18`, outline: `1.5px solid ${c.color}55`, minWidth: 64 } : { minWidth: 64 }}>
              <span className="text-2xl leading-none">{c.icon}</span>
              <span className="text-[10px] font-semibold text-2 truncate" style={{ maxWidth: 56, color: categoryId === c.id ? c.color : undefined }}>
                {c.name.split(' ')[0]}
              </span>
            </button>
          ))}
          {!showQuickAdd && (
            <button type="button" onClick={() => setShowQuickAdd(true)}
              className="flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap bg-card2" style={{ minWidth: 56 }}>
              <span className="text-2xl leading-none text-brand">+</span>
              <span className="text-[10px] font-semibold text-3">New</span>
            </button>
          )}
        </div>
        {showQuickAdd && (
          <div className="mt-2 p-3 rounded-xl bg-card2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input placeholder="📦" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} className="input w-12 text-center text-lg py-1.5" />
              <input placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                className="input flex-1 text-sm py-1.5" onKeyDown={e => e.key === 'Enter' && handleQuickAddCategory()} />
              <button type="button" onClick={() => setShowQuickAdd(false)} className="tap text-3 p-1"><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2">
              {QUICK_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewCatColor(c)}
                  className={cn('w-5 h-5 rounded-full tap shrink-0', newCatColor === c && 'ring-2 ring-offset-1 ring-white')}
                  style={{ backgroundColor: c }} />
              ))}
              <button type="button" onClick={handleQuickAddCategory} className="ml-auto btn btn-brand text-xs py-1 px-3 rounded-lg">Add</button>
            </div>
          </div>
        )}
      </div>

      {/* Pills: location, notes, recurring */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setShowLocation(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
          style={pill(showLocation || !!location)}>
          <MapPin size={11} />{location || 'Location'}
        </button>
        <button type="button" onClick={() => setShowNotes(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
          style={pill(showNotes || !!notes)}>
          {notes ? <Check size={11} /> : <StickyNote size={11} />} Notes
        </button>
        <button type="button" onClick={() => setIsRecurring(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
          style={pill(isRecurring)}>
          <RefreshCw size={11} />{isRecurring ? 'Recurring' : 'Repeat'}
        </button>
      </div>
      {showLocation && (
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
          <MapPin size={14} className="text-3 shrink-0" />
          <input className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3"
            placeholder="e.g. Big Bazaar, Online" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
      )}
      {showNotes && (
        <textarea className="input resize-none min-h-[64px] text-sm" placeholder="Notes…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      )}
      {isRecurring && (
        <Select
          options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]}
          value={recurrenceInterval}
          onChange={e => setRecurrenceInterval(e.target.value as RecurrenceInterval)}
        />
      )}
    </div>
  )

  return (
    <div className="flex flex-col">

      {/* ─── Sticky header ─── */}
      <div className="sticky top-0 z-20 border-b border-ui shrink-0" style={{ background: 'var(--bg-card)' }}>
        <div className="flex gap-1.5 px-4 pt-3 pb-2.5">
          {(['todo', 'checklist'] as TaskType[]).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={cn('flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl text-sm font-bold tap transition-all', type === t ? 'grad-brand text-white shadow-lg' : 'bg-card2 text-2')}>
              {t === 'todo' ? <ListChecks size={15} /> : <ShoppingCart size={15} />}
              {t === 'todo' ? 'Todo' : 'Checklist'}
            </button>
          ))}
        </div>
        <div className="px-4 pb-3">
          <input ref={titleRef}
            className="w-full bg-transparent text-base font-semibold text-1 outline-none placeholder:text-3"
            placeholder={type === 'checklist' ? 'List name (e.g. Weekly Groceries)' : 'What do you need to do?'}
            value={title} onChange={e => setTitle(e.target.value)} />
          {errors.title && <p className="text-xs mt-0.5" style={{ color: 'var(--expense)' }}>{errors.title}</p>}
        </div>
      </div>

      {/* ─── Scrollable body ─── */}
      <div className="px-4 pt-3 pb-3 flex flex-col gap-3">

        {/* ══ TODO MODE ══ */}
        {type === 'todo' && (
          <>
            <OptionsPanel />
            {/* Amount */}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <span className="text-sm text-3 shrink-0">{currencySymbol}</span>
                <input type="number" inputMode="decimal"
                  className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3"
                  placeholder="Est. amount (optional)" min="0" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <button type="button" onClick={() => setShowCurrency(v => !v)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
                style={pill(showCurrency || currency !== settings.defaultCurrency)}>
                {currency}
              </button>
            </div>
            {showCurrency && (
              <Select options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} — ${c.name}` }))}
                value={currency} onChange={e => setCurrency(e.target.value)} />
            )}
          </>
        )}

        {/* ══ CHECKLIST MODE ══ */}
        {type === 'checklist' && (
          <>
            {/* Collapsible options */}
            <button type="button"
              onClick={() => setShowOptions(v => !v)}
              className="flex items-center justify-between px-3 py-2 rounded-xl tap text-xs font-semibold transition-all"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <span className="flex items-center gap-1.5">
                <Settings size={12} /> Options
                {(dueDatetime || categoryId || priority !== 'medium' || location || notes || isRecurring) && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--brand)' }} />
                )}
              </span>
              {showOptions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showOptions && (
              <div className="rounded-xl p-3 flex flex-col gap-3" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
                <OptionsPanel />
              </div>
            )}

            {/* ─── Items section ─── */}
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold text-3 uppercase tracking-wider">Items</p>
                  {shoppingMode && checklistTotal > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(124,92,252,0.12)', color: 'var(--brand)' }}>
                      Est. {currencySymbol}{checklistTotal.toFixed(0)}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setShoppingMode(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold tap transition-all"
                  style={shoppingMode
                    ? { background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.4)', color: 'var(--brand)' }
                    : { background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  {shoppingMode ? <ShoppingCart size={11} /> : <StickyNote size={11} />}
                  {shoppingMode ? 'Shopping' : 'Generic'}
                </button>
              </div>

              {/* Column labels when shopping */}
              {shoppingMode && (
                <div className="flex items-center gap-2 px-2.5 mb-1">
                  <span style={{ width: 13 }} className="shrink-0" />
                  <span className="flex-1 text-[10px] text-3 font-medium min-w-0">Item</span>
                  <span className="text-[10px] text-3 font-medium shrink-0 text-center" style={{ width: 36 }}>Qty</span>
                  <span className="text-[10px] text-3 font-medium shrink-0 text-right" style={{ width: 56 }}>Price</span>
                  <span style={{ width: 20 }} className="shrink-0" />
                </div>
              )}

              {/* Items list */}
              {items.length > 0 && (
                <Reorder.Group axis="y" values={items} onReorder={setItems}
                  className="flex flex-col gap-1.5 mb-2"
                  style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map(item => (
                    <ChecklistItemRow key={item.id} item={item} shoppingMode={shoppingMode}
                      currencySymbol={currencySymbol} onUpdate={updateItem} onRemove={removeItem} />
                  ))}
                </Reorder.Group>
              )}

              {errors.items && <p className="text-xs mb-2" style={{ color: 'var(--expense)' }}>{errors.items}</p>}

              {/* ─── Add item row — keyboard stays open ─── */}
              <div ref={addItemRowRef}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2"
                style={{ background: 'var(--bg-card2)', border: '1.5px dashed var(--border2)' }}>
                <input
                  ref={newItemRef}
                  className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3 min-w-0"
                  placeholder="Item name…"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onFocus={() => setTimeout(() => scrollIntoScrollContainer(addItemRowRef.current), 400)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem() } }}
                />
                {shoppingMode && (
                  <>
                    <input
                      ref={newQtyRef}
                      type="number" inputMode="numeric"
                      className="bg-transparent text-xs text-2 outline-none text-center shrink-0 rounded px-1"
                      style={{ width: 36, background: 'var(--bg-card3)' }}
                      placeholder="qty" min="1"
                      value={newItemQty}
                      onChange={e => setNewItemQty(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem() } }}
                    />
                    <div className="flex items-center shrink-0 rounded px-1" style={{ background: 'var(--bg-card3)' }}>
                      <span className="text-[10px] text-3">{currencySymbol}</span>
                      <input
                        type="number" inputMode="decimal"
                        className="bg-transparent text-xs text-1 outline-none text-right shrink-0"
                        style={{ width: 44 }}
                        placeholder="0" min="0" step="0.01"
                        value={newItemPrice}
                        onChange={e => setNewItemPrice(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem() } }}
                      />
                    </div>
                  </>
                )}
                {/* Add button — inside scroll area, keeps keyboard open */}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-8 h-8 flex items-center justify-center rounded-lg tap shrink-0 transition-all"
                  style={{
                    background: newItemName.trim() ? 'var(--brand)' : 'var(--bg-card3)',
                    opacity: newItemName.trim() ? 1 : 0.5,
                  }}>
                  <ArrowRight size={14} className="text-white" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Sticky footer ─── */}
      <div className="sticky bottom-0 z-10 px-4 pt-2 pb-3 shrink-0"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        {type === 'checklist' ? (
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-semibold tap shrink-0"
              style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              Cancel
            </button>
            <button type="button"
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white tap transition-all"
              style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 4px 16px rgba(124,92,252,0.3)', opacity: loading ? 0.7 : 1 }}
              onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving…' : task ? 'Update' : 'Create Checklist'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <button type="button"
              className="w-full py-3.5 rounded-2xl text-base font-bold text-white tap transition-all"
              style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 4px 16px rgba(124,92,252,0.3)', opacity: loading ? 0.7 : 1 }}
              onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving…' : task ? 'Update Task' : 'Add Task'}
            </button>
            <button type="button" className="text-sm text-3 tap text-center py-1" onClick={onClose}>Cancel</button>
          </div>
        )}
      </div>

    </div>
  )
}

