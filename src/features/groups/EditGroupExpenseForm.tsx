import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Hash, Camera, X, CalendarDays, Scale, PenLine, Check, StickyNote } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/core/utils'
import { CURRENCIES, PAYMENT_METHOD_LABELS } from '@/core/constants'
import type { Group, GroupExpense, Category, PaymentMethod, Tag } from '@/core/types'
import { tagQueries } from '@/db/queries'
import { compressImage } from '@/utils/image'
import { PaymentMethodIcon } from '@/components/ui/PaymentMethodIcon'

export function EditGroupExpenseForm({ group, expense, categories, onClose, onSave }: {
  group: Group
  expense: GroupExpense
  categories: Category[]
  onClose: () => void
  onSave: (data: Partial<GroupExpense>) => Promise<void>
}) {
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(expense.amount.toString())
  const [categoryId, setCategoryId] = useState(expense.categoryId ?? '')
  const [paidBy, setPaidBy] = useState(expense.paidBy)
  const [notes, setNotes] = useState(expense.notes ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(expense.paymentMethod ?? 'cash')
  const [showPaymentMethod, setShowPaymentMethod] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(expense.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [showTags, setShowTags] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(expense.attachments?.[0] ?? null)
  const receiptRef = useRef<HTMLInputElement>(null)
  const [date, setDate] = useState(format(new Date(expense.date), "yyyy-MM-dd'T'HH:mm"))
  const [splits, setSplits] = useState(() => {
    const existing = expense.splits.map(s => ({ ...s, amountStr: s.amount.toString() }))
    // Ensure every group member has a split entry
    group.members.forEach(m => {
      if (!existing.find(s => s.memberId === m.id)) {
        existing.push({ memberId: m.id, amount: 0, amountStr: '0', settled: false })
      }
    })
    return existing
  })
  const [loading, setLoading] = useState(false)
  const [editSplitType, setEditSplitType] = useState<'equal' | 'custom'>('custom')
  const [ignoredEditMembers, setIgnoredEditMembers] = useState<Set<string>>(
    new Set(expense.splits.filter(s => s.amount === 0 && !s.settled).map(s => s.memberId))
  )
  const expenseCategories = categories.filter(c => !c.parentId)

  useEffect(() => { tagQueries.getAll().then(setAllTags) }, [])

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

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file)
      setReceipt(compressed)
    } catch { toast.error('Failed to attach image') }
    e.target.value = ''
  }

  const toggleIgnoreEditMember = (memberId: string) =>
    setIgnoredEditMembers(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
        setSplits(prev => prev.map(s => s.memberId === memberId ? { ...s, amount: 0, amountStr: '0' } : s))
      }
      return next
    })

  const redistributeEqual = () => {
    const total = parseFloat(amount) || 0
    const activeCount = splits.filter(s => !ignoredEditMembers.has(s.memberId)).length
    const per = activeCount > 0 ? parseFloat((total / activeCount).toFixed(2)) : 0
    setSplits(prev => prev.map(s => ({
      ...s,
      amount: ignoredEditMembers.has(s.memberId) ? 0 : per,
      amountStr: ignoredEditMembers.has(s.memberId) ? '0' : per.toString(),
    })))
  }

  const handleSave = async () => {
    const totalAmount = parseFloat(amount)
    if (!description.trim() || isNaN(totalAmount) || totalAmount <= 0) return
    setLoading(true)
    const activeMembers = group.members.filter(m => !ignoredEditMembers.has(m.id))
    const perPerson = activeMembers.length > 0
      ? parseFloat((totalAmount / activeMembers.length).toFixed(2))
      : 0
    await onSave({
      description: description.trim(),
      amount: totalAmount,
      categoryId: categoryId || undefined,
      paidBy,
      paymentMethod,
      tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      attachments: receipt ? [receipt] : undefined,
      notes: notes.trim() || undefined,
      date: new Date(date).getTime(),
      splits: group.members.map(m => {
        const ignored = ignoredEditMembers.has(m.id)
        const origSplit = expense.splits.find(s => s.memberId === m.id)
        const editedSplit = splits.find(s => s.memberId === m.id)
        return {
          memberId: m.id,
          amount: ignored ? 0 : editSplitType === 'equal'
            ? perPerson
            : parseFloat(editedSplit?.amountStr ?? '0'),
          settled: origSplit?.settled ?? false,
          settledAt: origSplit?.settledAt,
          settledBy: origSplit?.settledBy,
        }
      }),
    })
  }

  const currencySymbol = CURRENCIES.find(c => c.code === group.currency)?.symbol ?? group.currency[0]

  return (
    <div className="flex flex-col">

      {/* ─── Sticky header: matches ExpenseForm group mode ─── */}
      <div className="sticky top-0 z-10 border-b border-ui" style={{ background: 'var(--bg-card)' }}>
        <div className="px-4 pt-3 pb-1 text-center" style={{ background: 'linear-gradient(160deg,#2a1860,#16123a)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(200,195,240,0.5)' }}>
            {group.currency} · {group.name}
          </p>
          <div className="flex items-center justify-center gap-1 py-1">
            <span className="text-4xl font-bold" style={{ color: 'rgba(200,195,240,0.5)' }}>{currencySymbol}</span>
            <input
              type="number" inputMode="decimal" placeholder="0"
              step="0.01" min="0" autoFocus
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="bg-transparent text-5xl font-bold outline-none placeholder:text-3 text-center w-[180px]"
              style={{ maxWidth: 'calc(100% - 56px)', minWidth: 80, color: '#f0eeff' }}
            />
          </div>
        </div>
        <div className="px-4 pb-3 pt-2">
          <input
            className="w-full bg-transparent text-sm text-center text-1 outline-none placeholder:text-3"
            placeholder="e.g. Dinner, Hotel, Taxi…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Scrollable body ─── */}
      <div className="px-4 pt-4 flex flex-col gap-4 pb-6">

        {/* Category — horizontal scroll, same as ExpenseForm */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {expenseCategories.map(c => (
            <button key={c.id} onClick={() => setCategoryId(c.id)}
              className={cn('flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap transition-all', categoryId === c.id ? '' : 'bg-card2')}
              style={categoryId === c.id
                ? { background: `${c.color}18`, outline: `1.5px solid ${c.color}55`, minWidth: 64 }
                : { minWidth: 64 }}>
              <span className="text-2xl leading-none">{c.icon}</span>
              <span className="text-[10px] font-semibold text-2 truncate"
                style={{ maxWidth: 56, color: categoryId === c.id ? c.color : undefined }}>
                {c.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Date — hidden input trick so no keyboard opens */}
        <label
          className="flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer relative"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', overflow: 'hidden' }}
        >
          <CalendarDays size={14} className="shrink-0 text-3" />
          <span className="text-xs text-1 truncate flex-1 font-medium">
            {date ? format(new Date(date), 'MMM d, yyyy · h:mm a') : 'Set date'}
          </span>
          <input
            type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            style={{ colorScheme: 'dark' }}
          />
        </label>

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

        {/* Splits — equal / custom toggle + new 2-line layout */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-3 uppercase tracking-wider">Split</p>
            <div className="flex gap-1.5">
              {(['equal', 'custom'] as const).map(t => (
                <button key={t}
                  onClick={() => { setEditSplitType(t); if (t === 'equal') redistributeEqual() }}
                  className={cn('flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold tap transition-all',
                    editSplitType === t ? 'grad-brand text-white' : 'bg-card2 text-2')}>
                  {t === 'equal' ? <Scale size={12} /> : <PenLine size={12} />}
                  {t === 'equal' ? 'Equal' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {group.members.map(m => {
              const split = splits.find(s => s.memberId === m.id)
              const splitIdx = splits.findIndex(s => s.memberId === m.id)
              const ignored = ignoredEditMembers.has(m.id)
              const isSettled = !!split?.settled
              const totalAmt = parseFloat(amount) || 0
              const activeMembers = group.members.filter(x => !ignoredEditMembers.has(x.id))
              const base = activeMembers.length > 0 && totalAmt > 0 ? Math.floor((totalAmt / activeMembers.length) * 100) / 100 : 0
              const roundRem = activeMembers.length > 0 && totalAmt > 0 ? parseFloat((totalAmt - base * activeMembers.length).toFixed(2)) : 0
              const equalAmt = ignored ? 0 : (activeMembers[0]?.id === m.id ? base + roundRem : base)
              return (
                <div key={m.id}
                  className="rounded-2xl overflow-hidden transition-all"
                  style={{
                    background: ignored ? 'rgba(255,255,255,0.02)' : 'var(--bg-card2)',
                    border: `1.5px solid ${ignored ? 'rgba(255,255,255,0.06)' : 'var(--border)'}`,
                    opacity: ignored ? 0.5 : 1,
                  }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: ignored ? '#666' : m.avatarColor }}>
                      {m.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold truncate', ignored ? 'text-3 line-through' : 'text-1')}>
                        {m.name}
                      </p>
                      {isSettled && (
                        <p className="text-[10px] mt-0.5 font-medium flex items-center gap-1" style={{ color: '#00c896' }}><Check size={10} /> Settled</p>
                      )}
                      {editSplitType === 'equal' && !ignored && totalAmt > 0 && (
                        <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--brand)' }}>
                          {currencySymbol}{equalAmt.toFixed(2)}
                        </p>
                      )}
                      {ignored && <p className="text-[10px] text-3 mt-0.5">Not in this split</p>}
                    </div>
                    <button onClick={() => toggleIgnoreEditMember(m.id)}
                      className="px-2.5 py-1.5 rounded-xl tap text-[11px] font-bold shrink-0 transition-all"
                      style={ignored
                        ? { background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.3)' }
                        : { background: 'rgba(255,107,107,0.08)', color: 'rgba(255,107,107,0.8)', border: '1px solid rgba(255,107,107,0.2)' }}>
                      {ignored ? '+ Include' : '× Exclude'}
                    </button>
                  </div>
                  {editSplitType === 'custom' && !ignored && (
                    isSettled ? (
                      <div className="px-3 pb-3">
                        <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                          style={{ background: 'rgba(0,200,150,0.06)', border: '1.5px solid rgba(0,200,150,0.2)' }}>
                          <span className="text-lg font-bold shrink-0" style={{ color: 'rgba(0,200,150,0.6)' }}>
                            {currencySymbol}
                          </span>
                          <span className="flex-1 text-xl font-bold text-right" style={{ color: '#00c896' }}>
                            {(split?.amount ?? 0).toFixed(2)}
                          </span>
                          <Check size={13} className="shrink-0" style={{ color: '#00c896' }} />
                        </div>
                      </div>
                    ) : (
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
                            value={split?.amountStr ?? '0'}
                            onChange={e => splitIdx >= 0 && setSplits(prev => prev.map((s, j) => j === splitIdx
                              ? { ...s, amountStr: e.target.value, amount: parseFloat(e.target.value) || 0 }
                              : s))}
                            className="flex-1 bg-transparent text-xl font-bold text-1 text-right outline-none placeholder:text-3 min-w-0"
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              )
            })}

            {/* Distribution bar */}
            {editSplitType === 'custom' && (() => {
              const totalAmt = parseFloat(amount) || 0
              const sum = splits
                .filter(s => !ignoredEditMembers.has(s.memberId))
                .reduce((acc, s) => acc + (parseFloat(s.amountStr) || 0), 0)
              const remaining = totalAmt - sum
              const pct = totalAmt > 0 ? Math.min(100, (sum / totalAmt) * 100) : 0
              const ok = Math.abs(remaining) < 1
              return totalAmt > 0 ? (
                <div className="rounded-2xl px-4 py-3"
                  style={{ background: 'var(--bg-card2)', border: '1.5px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-3">Distributed</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold tabular-nums" style={{ color: ok ? '#00c896' : 'var(--text-1)' }}>
                        {currencySymbol}{sum.toFixed(2)}
                      </span>
                      <span className="text-xs text-3">of {currencySymbol}{totalAmt.toFixed(2)}</span>
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
              ) : null
            })()}
          </div>
        </div>

        {/* Notes */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
          <StickyNote size={14} className="shrink-0 text-3" />
          <input
            className="flex-1 bg-transparent text-sm text-1 outline-none placeholder:text-3"
            placeholder="Add a note… (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowTags(v => !v)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-2xl tap transition-all"
            style={{ background: 'var(--bg-card2)', border: `1px solid ${showTags || selectedTagIds.length > 0 ? 'rgba(124,92,252,0.4)' : 'var(--border)'}` }}>
            <Hash size={15} className="shrink-0" style={{ color: selectedTagIds.length > 0 ? 'var(--brand)' : 'var(--text-3)' }} />
            <span className="text-sm text-1 flex-1 text-left">
              {selectedTagIds.length > 0 ? `${selectedTagIds.length} Tag${selectedTagIds.length > 1 ? 's' : ''}` : 'Add tags'}
            </span>
            <span className="text-[10px] text-3 font-semibold uppercase tracking-wider">Tags</span>
          </button>
          {showTags && (
            <div className="flex flex-col gap-2 p-3 rounded-2xl" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
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
        </div>

        {/* Receipt */}
        <div className="flex flex-col gap-2">
          <input ref={receiptRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
          <button
            onClick={() => receiptRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2.5 rounded-2xl tap transition-all"
            style={{ background: 'var(--bg-card2)', border: `1px solid ${receipt ? 'rgba(0,200,150,0.4)' : 'var(--border)'}` }}>
            <Camera size={15} className="shrink-0" style={{ color: receipt ? '#00c896' : 'var(--text-3)' }} />
            <span className="text-sm text-1 flex-1 text-left" style={{ color: receipt ? '#00c896' : undefined }}>
              {receipt ? 'Receipt attached' : 'Attach receipt'}
            </span>
            <span className="text-[10px] text-3 font-semibold uppercase tracking-wider">Photo</span>
          </button>
          {receipt && (
            <div className="flex items-center gap-3 px-1">
              <div className="relative shrink-0">
                <img src={receipt} className="w-14 h-14 rounded-xl object-cover border border-ui" alt="Receipt" />
                <button onClick={() => setReceipt(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--expense)' }}>
                  <X size={10} className="text-white" />
                </button>
              </div>
              <p className="text-xs text-2">Tap to replace</p>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowPaymentMethod(v => !v)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-2xl tap transition-all"
            style={{ background: 'var(--bg-card2)', border: `1px solid ${showPaymentMethod ? 'rgba(124,92,252,0.4)' : 'var(--border)'}` }}>
            <PaymentMethodIcon method={paymentMethod} size={15} className="shrink-0" />
            <span className="text-sm text-1 flex-1 text-left">{PAYMENT_METHOD_LABELS[paymentMethod]}</span>
            <span className="text-[10px] text-3 font-semibold uppercase tracking-wider">Payment</span>
          </button>
          {showPaymentMethod && (
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => (
                <button key={value}
                  onClick={() => { setPaymentMethod(value); setShowPaymentMethod(false) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl tap transition-all text-xs font-semibold"
                  style={paymentMethod === value
                    ? { background: 'rgba(124,92,252,0.2)', border: '1.5px solid rgba(124,92,252,0.5)', color: 'var(--brand)' }
                    : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}>
                  <PaymentMethodIcon method={value} size={13} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save */}
        <button
          className="w-full py-4 rounded-2xl text-base font-bold text-white tap transition-all mt-1"
          style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 6px 20px rgba(124,92,252,0.3)', opacity: loading ? 0.7 : 1 }}
          onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
        <button className="text-sm text-3 tap text-center py-1" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
