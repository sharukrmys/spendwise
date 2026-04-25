import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, X, MapPin, RefreshCw, GripVertical } from 'lucide-react'
import { Reorder } from 'framer-motion'
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

export function TaskForm({ onClose, task, defaultType = 'todo' }: TaskFormProps) {
  const { addTask, updateTask, load } = useTaskStore()
  const { categories, addCategory } = useCategoryStore()
  const { settings } = useSettingsStore()

  const [type, setType] = useState<TaskType>(task?.type ?? defaultType)
  const [title, setTitle] = useState(task?.title ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [dueDatetime, setDueDatetime] = useState(
    task?.dueDate
      ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm")
      : ''
  )
  const [location, setLocation] = useState(task?.location ?? '')
  const [amount, setAmount] = useState(task?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState(task?.currency ?? settings.defaultCurrency)
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? '')
  const [isRecurring, setIsRecurring] = useState(task?.isRecurring ?? false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval>(
    task?.recurrence?.interval ?? 'weekly'
  )
  const [showCurrency, setShowCurrency] = useState(false)
  const [showLocation, setShowLocation] = useState(!!task?.location)
  const [showNotes, setShowNotes] = useState(!!task?.notes)

  // Checklist items
  const [items, setItems] = useState<ChecklistItem[]>(
    task?.items ?? []
  )
  const [newItemName, setNewItemName] = useState('')
  const newItemRef = useRef<HTMLInputElement>(null)

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

  const checklistTotal = items.reduce((s, i) => {
    const qty = i.quantity ?? 1
    return s + (i.estimatedPrice ?? 0) * qty
  }, 0)

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency[0]

  const addItem = () => {
    const name = newItemName.trim()
    if (!name) return
    setItems(prev => [...prev, { id: generateId(), name, checked: false }])
    setNewItemName('')
    setTimeout(() => newItemRef.current?.focus(), 30)
  }

  const updateItem = (id: string, patch: Partial<ChecklistItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
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
        type,
        title: title.trim(),
        priority,
        status: task?.status ?? 'pending',
        notes: notes.trim() || undefined,
        dueDate: dueDateTs,
        dueTime: dueTimeStr,
        location: location.trim() || undefined,
        amount: amount && parseFloat(amount) > 0 ? parseFloat(amount) : undefined,
        currency,
        categoryId: categoryId || undefined,
        items: type === 'checklist' ? items : undefined,
        isRecurring,
        recurrence: isRecurring ? { interval: recurrenceInterval } : undefined,
        convertedExpenseId: task?.convertedExpenseId,
      }

      if (task) {
        await updateTask(task.id, data)
        toast.success('Task updated')
      } else {
        await addTask(data)
        toast.success(type === 'checklist' ? 'Checklist created!' : 'Task added!')
      }
      await load()
      onClose()
    } catch {
      toast.error('Failed to save task')
    } finally {
      setLoading(false)
    }
  }

  const pill = (active: boolean, color = '#7c5cfc') => active
    ? { background: `${color}18`, border: `1.5px solid ${color}45`, color }
    : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-3)' } as React.CSSProperties

  return (
    <div className="flex flex-col">
      {/* ─── Type toggle ─── */}
      <div className="sticky top-0 z-20 border-b border-ui" style={{ background: 'var(--bg-card)' }}>
        <div className="flex gap-1.5 px-4 pt-3 pb-3">
          {(['todo', 'checklist'] as TaskType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-bold tap transition-all',
                type === t ? 'grad-brand text-white shadow-lg' : 'bg-card2 text-2'
              )}
            >
              {t === 'todo' ? '☑ Todo' : '🛒 Checklist'}
            </button>
          ))}
        </div>

        {/* Title */}
        <div className="px-4 pb-3">
          <input
            ref={titleRef}
            className="w-full bg-transparent text-base font-semibold text-1 outline-none placeholder:text-3"
            placeholder={type === 'checklist' ? 'List name (e.g. Weekly Groceries)' : 'What do you need to do?'}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          {errors.title && <p className="text-xs mt-0.5" style={{ color: 'var(--expense)' }}>{errors.title}</p>}
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 pb-2">

        {/* ─── Priority ─── */}
        <div>
          <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Priority</p>
          <div className="flex gap-2">
            {PRIORITY_CONFIG.map(p => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl tap transition-all text-xs font-semibold"
                style={priority === p.value
                  ? { background: `${p.color}18`, border: `1.5px solid ${p.color}55`, color: p.color }
                  : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-3)' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Due date + time ─── */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
          onClick={openDatePicker}
        >
          <span className="text-sm shrink-0">📅</span>
          <span className="text-xs text-1 truncate flex-1 font-medium">
            {dueDatetime ? format(new Date(dueDatetime), 'MMM d, yyyy · h:mm a') : 'Due date & time (optional)'}
          </span>
          <input
            ref={dueDateRef}
            type="datetime-local"
            value={dueDatetime}
            onChange={e => setDueDatetime(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            style={{ colorScheme: 'dark' }}
          />
          {dueDatetime && (
            <button
              className="relative z-10 tap text-3 shrink-0 p-0.5"
              onClick={e => { e.stopPropagation(); setDueDatetime('') }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* ─── Category ─── */}
        <div>
          <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Category</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setCategoryId('')}
              className={cn(
                'flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap transition-all',
                !categoryId ? 'bg-card3' : 'bg-card2'
              )}
              style={{ minWidth: 56, ...((!categoryId) ? { outline: '1.5px solid rgba(124,92,252,0.4)' } : {}) }}
            >
              <span className="text-2xl leading-none">✨</span>
              <span className="text-[10px] font-semibold text-2">None</span>
            </button>
            {parentCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap transition-all',
                  categoryId === c.id ? '' : 'bg-card2'
                )}
                style={categoryId === c.id
                  ? { background: `${c.color}18`, outline: `1.5px solid ${c.color}55`, minWidth: 64 }
                  : { minWidth: 64 }}
              >
                <span className="text-2xl leading-none">{c.icon}</span>
                <span className="text-[10px] font-semibold text-2 truncate" style={{ maxWidth: 56, color: categoryId === c.id ? c.color : undefined }}>
                  {c.name.split(' ')[0]}
                </span>
              </button>
            ))}
            {!showQuickAdd && (
              <button
                onClick={() => setShowQuickAdd(true)}
                className="flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap bg-card2"
                style={{ minWidth: 56 }}
              >
                <span className="text-2xl leading-none text-brand">+</span>
                <span className="text-[10px] font-semibold text-3">New</span>
              </button>
            )}
          </div>

          {showQuickAdd && (
            <div className="mt-2 p-3 rounded-xl bg-card2 flex flex-col gap-2">
              <div className="flex gap-2">
                <input placeholder="📦" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                  className="input w-12 text-center text-lg py-1.5" />
                <input placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  className="input flex-1 text-sm py-1.5"
                  onKeyDown={e => e.key === 'Enter' && handleQuickAddCategory()} />
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

        {/* ─── Checklist items ─── */}
        {type === 'checklist' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-3 uppercase tracking-wider">Items</p>
              {checklistTotal > 0 && (
                <span className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
                  Est. {currencySymbol}{checklistTotal.toFixed(0)}
                </span>
              )}
            </div>

            {items.length > 0 && (
              <Reorder.Group axis="y" values={items} onReorder={setItems} className="flex flex-col gap-1.5 mb-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((item) => (
                  <Reorder.Item key={item.id} value={item} style={{ listStyle: 'none' }}>
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', touchAction: 'none' }}>
                      <GripVertical size={13} className="text-3 shrink-0 cursor-grab active:cursor-grabbing" />
                      <input
                        className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3 min-w-0"
                        placeholder="Item name"
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                      />
                      <input
                        type="number"
                        className="bg-transparent text-xs text-2 outline-none text-center w-8"
                        placeholder="qty"
                        min="1"
                        value={item.quantity ?? ''}
                        onChange={e => updateItem(item.id, { quantity: e.target.value ? parseInt(e.target.value) : undefined })}
                      />
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className="text-xs text-3">{currencySymbol}</span>
                        <input
                          type="number"
                          className="bg-transparent text-xs text-1 outline-none text-right w-16"
                          placeholder="price"
                          min="0"
                          step="0.01"
                          value={item.estimatedPrice ?? ''}
                          onChange={e => updateItem(item.id, { estimatedPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                        />
                      </div>
                      <button onClick={() => removeItem(item.id)} className="tap text-3 shrink-0 p-0.5">
                        <X size={13} />
                      </button>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}

            {errors.items && <p className="text-xs mb-2" style={{ color: 'var(--expense)' }}>{errors.items}</p>}

            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-card2)', border: '1.5px dashed var(--border2)' }}>
                <input
                  ref={newItemRef}
                  className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3"
                  placeholder="Add item…"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                />
              </div>
              <button
                onClick={addItem}
                className="w-9 h-9 flex items-center justify-center rounded-xl tap shrink-0"
                style={{ background: 'var(--brand)' }}
              >
                <Plus size={16} className="text-white" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Todo: Amount ─── */}
        {type === 'todo' && (
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <span className="text-sm text-3 shrink-0">{currencySymbol}</span>
              <input
                type="number"
                className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3"
                placeholder="Est. amount (optional)"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowCurrency(v => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
              style={pill(showCurrency || currency !== settings.defaultCurrency)}
            >
              {currency}
            </button>
          </div>
        )}

        {showCurrency && (
          <Select
            options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} — ${c.name}` }))}
            value={currency}
            onChange={e => setCurrency(e.target.value)}
          />
        )}

        {/* ─── Pill row: location, notes, recurring ─── */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowLocation(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
            style={pill(showLocation || !!location)}
          >
            <MapPin size={11} />
            {location || 'Location'}
          </button>

          <button
            onClick={() => setShowNotes(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
            style={pill(showNotes || !!notes)}
          >
            📝 {notes ? 'Notes ✓' : 'Notes'}
          </button>

          <button
            onClick={() => setIsRecurring(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tap transition-all"
            style={pill(isRecurring)}
          >
            <RefreshCw size={11} />
            {isRecurring ? 'Recurring' : 'Repeat'}
          </button>
        </div>

        {showLocation && (
          <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <MapPin size={14} className="text-3 shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3"
              placeholder="e.g. Big Bazaar, Online"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
        )}

        {showNotes && (
          <textarea
            className="input resize-none min-h-[72px] text-sm"
            placeholder="Notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        )}

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

      </div>

      {/* ─── Sticky footer: Save / Cancel ─── */}
      <div
        className="sticky bottom-0 z-10 px-4 pt-2 pb-4 flex flex-col gap-1"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}
      >
        <button
          className="w-full py-4 rounded-2xl text-base font-bold text-white tap transition-all"
          style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 6px 20px rgba(124,92,252,0.3)', opacity: loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Saving…' : task ? 'Update Task' : type === 'checklist' ? 'Create Checklist' : 'Add Task'}
        </button>
        <button className="text-sm text-3 tap text-center py-1" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
