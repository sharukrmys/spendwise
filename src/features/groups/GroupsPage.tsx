import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Users, ArrowRight, UserPlus, Trash2, ChevronLeft, ChevronRight, Share2, RefreshCw, Link, LogIn, Copy, Check, ShieldOff, CloudOff, BarChart2, Download, Camera, Hash, X, ChevronDown, Upload } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGroupStore } from '@/store/useGroupStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { formatCurrency, cn } from '@/core/utils'
import { CURRENCIES, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '@/core/constants'
import type { Group, GroupExpense, PaymentMethod, Tag } from '@/core/types'
import { tagQueries, expenseQueries } from '@/db/queries'
import { useExpenseStore } from '@/store/useExpenseStore'
import { toast } from '@/components/ui/Toast'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns'
import { exportGroupData } from '@/services/exportXlsx'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'

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

// ─── Group List ──────────────────────────────────────────────────────
export function GroupsPage() {
  const { groups, load, setActiveGroup: setStoreActiveGroup, unarchiveGroup, addGroup, addGroupExpense, loadGroupExpenses, groupExpenses } = useGroupStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const handleImportGroup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text) as { group: Group; expenses: GroupExpense[] }
      if (!data.group || !data.group.name) throw new Error('Invalid group file')
      // Create new group (with a new local ID to avoid conflicts)
      const newGroup = await addGroup(data.group.name, data.group.description, data.group.currency)
      // Import members
      const memberIdMap: Record<string, string> = {}
      for (const member of data.group.members) {
        await useGroupStore.getState().addMember(newGroup.id, member.name, member.email)
        const imported = useGroupStore.getState().groups.find(g => g.id === newGroup.id)
        const added = imported?.members.find(m => m.name === member.name)
        if (added) memberIdMap[member.id] = added.id
      }
      // Import expenses with remapped member IDs
      for (const ge of (data.expenses ?? [])) {
        await addGroupExpense({
          groupId: newGroup.id,
          description: ge.description,
          amount: ge.amount,
          currency: ge.currency,
          paidBy: memberIdMap[ge.paidBy] ?? ge.paidBy,
          splits: ge.splits.map(s => ({ ...s, memberId: memberIdMap[s.memberId] ?? s.memberId })),
          date: ge.date,
          categoryId: ge.categoryId,
          paymentMethod: ge.paymentMethod,
          notes: ge.notes,
        })
      }
      await load()
      toast.success(`"${newGroup.name}" imported with ${data.expenses?.length ?? 0} expenses`)
    } catch {
      toast.error('Import failed — invalid group file')
    }
    e.target.value = ''
  }

  const handleExportGroup = async (group: Group) => {
    await loadGroupExpenses(group.id)
    const expenses = groupExpenses[group.id] ?? []
    const data = { group, expenses }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `group-${group.name.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${group.name} exported`)
  }

  useEffect(() => { load() }, [])

  // Keep activeGroup in sync when store updates (e.g. after sync)
  useEffect(() => {
    if (activeGroup) {
      const updated = groups.find(g => g.id === activeGroup.id)
      if (updated) setActiveGroup(updated)
    }
  }, [groups])

  const openGroup = (g: Group) => {
    setStoreActiveGroup(g.id)
    setActiveGroup(g)
  }

  const closeGroup = () => {
    setStoreActiveGroup(null)
    setActiveGroup(null)
  }

  if (activeGroup) {
    return <GroupDetail group={activeGroup} onBack={closeGroup} />
  }

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-5">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(200,195,240,0.6)' }}>Split</p>
        <h1 className="text-2xl font-bold" style={{ color: '#f0eeff' }}>Groups</h1>
        <p className="text-xs mt-1" style={{ color: 'rgba(200,195,240,0.5)' }}>
          Share expenses across any group — data stays in your Google Drive
        </p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 pb-28">
        {groups.length === 0 ? (
          <>
            <EmptyState
              icon={<Users size={48} />}
              title="No groups yet"
              description="Create a group to split expenses. Share an invite code so others can join — all data syncs through Google Drive, no server involved."
              action={{ label: 'Create Group', onClick: () => setCreateOpen(true) }}
            />
            <button
              onClick={() => setJoinOpen(true)}
              className="flex items-center gap-3 w-full p-4 card tap transition-all"
            >
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.25)' }}>
                <LogIn size={18} className="text-brand" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-1">Join a group</p>
                <p className="text-xs text-2">Enter an invite code from a friend</p>
              </div>
            </button>
          </>
        ) : (
          <>
            {groups.filter(g => !g.archived).map(g => <GroupCard key={g.id} group={g} onOpen={() => openGroup(g)} onExport={() => handleExportGroup(g)} />)}
            <div className="flex gap-2">
              <button
                onClick={() => setCreateOpen(true)}
                className="flex-1 flex items-center gap-2.5 p-3.5 card tap transition-all"
              >
                <div className="w-9 h-9 grad-brand rounded-xl flex items-center justify-center shrink-0">
                  <Plus size={18} className="text-white" />
                </div>
                <span className="text-sm font-medium text-1">New group</span>
              </button>
              <button
                onClick={() => setJoinOpen(true)}
                className="flex-1 flex items-center gap-2.5 p-3.5 card tap transition-all"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.25)' }}>
                  <LogIn size={18} className="text-brand" />
                </div>
                <span className="text-sm font-medium text-1">Join group</span>
              </button>
              <button
                onClick={() => importRef.current?.click()}
                className="flex items-center gap-2.5 p-3.5 card tap transition-all"
                title="Import group from JSON file"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.2)' }}>
                  <Upload size={18} className="text-income" />
                </div>
              </button>
            </div>
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportGroup} />
            {groups.filter(g => g.archived).length > 0 && (
              <div>
                <button
                  onClick={() => setArchivedExpanded(v => !v)}
                  className="flex items-center gap-2 w-full px-1 py-2 tap"
                >
                  <ChevronDown size={14} className={cn('text-3 transition-transform', archivedExpanded && 'rotate-180')} />
                  <span className="text-xs font-semibold text-3">Archived ({groups.filter(g => g.archived).length})</span>
                </button>
                {archivedExpanded && (
                  <div className="flex flex-col gap-2 mt-1">
                    {groups.filter(g => g.archived).map(g => (
                      <div key={g.id} className="flex items-center gap-3 w-full p-4 card opacity-60">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--bg-card3)' }}>
                          <span className="text-xl font-bold text-2">{g.name[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold text-2">{g.name}</p>
                          <p className="text-xs text-3">{g.members.length} members · Archived</p>
                        </div>
                        <button
                          onClick={() => unarchiveGroup(g.id)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg tap shrink-0"
                          style={{ background: 'rgba(124,92,252,0.12)', color: 'var(--brand)' }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Group">
        <CreateGroupForm onClose={() => { setCreateOpen(false); load() }} />
      </Modal>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a Group" size="sm">
        <JoinGroupForm onClose={() => { setJoinOpen(false); load() }} />
      </Modal>
    </div>
  )
}

// ─── Group Card ──────────────────────────────────────────────────────
function GroupCard({ group, onOpen, onExport }: { group: Group; onOpen: () => void; onExport: () => void }) {
  const { getBalances } = useGroupStore()
  const { settings } = useSettingsStore()
  const balances = getBalances(group.id)
  const me = group.members.find(m => m.name === settings.myGroupName)
  const myBalance = me ? (balances[me.id] ?? 0) : null

  return (
    <div className="flex items-center gap-3 w-full p-4 card">
    <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 tap text-left">
      <div className="w-11 h-11 grad-brand rounded-2xl flex items-center justify-center shrink-0">
        <span className="text-xl font-bold text-white">{group.name[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-1">{group.name}</p>
        <p className="text-xs text-2">{group.members.length} members · {group.currency}</p>
      </div>
      {group.shareCode && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-brand px-2 py-0.5 rounded-lg mr-1" style={{ background: 'rgba(124,92,252,0.12)' }}>
          <Link size={9} /> Shared
        </span>
      )}
      {myBalance !== null && myBalance !== 0 && (
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-lg mr-1 shrink-0 tabular-nums"
          style={{
            background: myBalance > 0 ? 'rgba(0,200,150,0.12)' : 'rgba(255,107,107,0.12)',
            color: myBalance > 0 ? '#00c896' : '#ff6b6b',
          }}
        >
          {myBalance > 0
            ? `owed ${formatCurrency(myBalance, group.currency)}`
            : `owes ${formatCurrency(Math.abs(myBalance), group.currency)}`}
        </span>
      )}
      <ArrowRight size={16} className="text-3 shrink-0" />
    </button>
    <button
      onClick={e => { e.stopPropagation(); onExport() }}
      className="w-8 h-8 flex items-center justify-center rounded-xl tap shrink-0"
      style={{ background: 'rgba(0,200,150,0.1)' }}
      title="Export group to file"
    >
      <Download size={14} className="text-income" />
    </button>
    </div>
  )
}

// ─── Create Group Form ───────────────────────────────────────────────
function CreateGroupForm({ onClose }: { onClose: () => void }) {
  const { addGroup } = useGroupStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    await addGroup(name.trim(), description.trim() || undefined, currency)
    toast.success('Group created')
    onClose()
  }

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <Input label="Group name" placeholder="e.g. Trip to Bali" value={name} onChange={e => setName(e.target.value)} />
      <Input label="Description (optional)" placeholder="What's this group for?" value={description} onChange={e => setDescription(e.target.value)} />
      <Select
        label="Currency"
        options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.name}` }))}
        value={currency}
        onChange={e => setCurrency(e.target.value)}
      />
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleCreate} loading={loading} className="flex-1">Create</Button>
      </div>
    </div>
  )
}

// ─── Group Detail ────────────────────────────────────────────────────
function GroupDetail({ group, onBack }: { group: Group; onBack: () => void }) {
  const { loadGroupExpenses, groupExpenses, deleteGroupExpense, updateGroupExpense, addMember, addGroupExpense, settleUp, unsettle, getBalances, deleteGroup, updateGroup, shareGroup, syncSharedGroup, unshareGroup, syncingGroupId, archiveGroup } = useGroupStore()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<import('@/core/types').GroupExpense | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [tab, setTab] = useState<'expenses' | 'balances' | 'reports'>('expenses')
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const isSyncing = syncingGroupId === group.id
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      exportGroupData(group, expenses, categories)
    } catch (e) {
      toast.error('Export failed')
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { loadGroupExpenses(group.id) }, [group.id])

  // Sorted newest first by date
  const expenses = useMemo(() =>
    [...(groupExpenses[group.id] ?? [])].sort((a, b) => b.date - a.date),
    [groupExpenses[group.id]]
  )

  const monthExpenses = useMemo(() => {
    const start = startOfMonth(selectedMonth).getTime()
    const end = endOfMonth(selectedMonth).getTime()
    return expenses.filter(e => e.date >= start && e.date <= end)
  }, [expenses, selectedMonth])

  const monthTotal = monthExpenses
    .filter(e => e.notes !== '__settlement__')
    .reduce((s, e) => s + e.amount, 0)

  const isCurrentMonth = isSameMonth(selectedMonth, new Date())

  const balances = getBalances(group.id)
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  const handleDelete = async () => {
    await deleteGroup(group.id)
    onBack()
    toast.success('Group deleted')
  }

  const handleArchive = async () => {
    await archiveGroup(group.id)
    onBack()
    toast.success('Group archived')
  }

  const handleShare = async () => {
    try {
      await shareGroup(group.id)
      setShareModalOpen(true)
      toast.success('Group shared! Copy the invite code.')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleSync = async () => {
    try {
      await syncSharedGroup(group.id)
      await loadGroupExpenses(group.id)
      toast.success('Group synced!')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleUnshare = async () => {
    try {
      await unshareGroup(group.id)
      toast.success('Group sharing stopped')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* ── Hero Header ── */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-5">
        {/* Top bar: back + settings + sharing badge */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="flex items-center gap-1 text-sm tap" style={{ color: 'rgba(200,195,240,0.7)' }}>
            <ChevronLeft size={16} /> Groups
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl tap"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(200,195,240,0.7)' }}>⚙ Settings</span>
            </button>
            {/* Sharing status badge */}
            {group.shareCode ? (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl tap"
                style={{ background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.25)' }}
              >
                <RefreshCw size={10} className={cn('text-income', isSyncing && 'animate-spin')} />
                <span className="text-[10px] font-semibold text-income">
                  {isSyncing ? 'Syncing…' : 'Shared via Drive · Tap to sync'}
                </span>
              </button>
            ) : (
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl tap"
                style={{ background: 'rgba(124,92,252,0.12)', border: '1px solid rgba(124,92,252,0.25)' }}
              >
                <CloudOff size={10} className="text-brand" />
                <span className="text-[10px] font-semibold text-brand">Share group</span>
              </button>
            )}
          </div>
        </div>

        {/* Group name + member count */}
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: '#f0eeff' }}>{group.name}</h1>
        <p className="text-xs mb-4" style={{ color: 'rgba(200,195,240,0.5)' }}>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</p>

        {/* Donut (left) + spend info + member list (right) */}
        {(() => {
          const memberSpend = group.members.map(m => ({
            m,
            paid: expenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0),
          }))
          const donutData = memberSpend.filter(x => x.paid > 0).map(x => ({ value: x.paid, color: x.m.avatarColor }))
          const fallback = [{ value: 1, color: '#2d2650' }]
          return (
            <div className="flex items-center gap-4">
              {/* Donut */}
              <div className="relative shrink-0 w-[90px] h-[90px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData.length ? donutData : fallback} cx="50%" cy="50%"
                      innerRadius={28} outerRadius={42} paddingAngle={donutData.length > 1 ? 3 : 0}
                      dataKey="value" strokeWidth={0}>
                      {(donutData.length ? donutData : fallback).map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[9px] leading-none mb-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>Spent</p>
                  <p className="text-[10px] font-bold leading-none" style={{ color: '#f0eeff' }}>{expenses.length}</p>
                </div>
              </div>
              {/* Right: total + per-member */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(200,195,240,0.45)' }}>Total Group Spend</p>
                <p className="text-2xl font-bold mb-2" style={{ color: '#f0eeff' }}>{formatCurrency(totalSpent, group.currency)}</p>
                <div className="flex flex-col gap-1">
                  {memberSpend.map(({ m, paid }) => (
                    <div key={m.id} className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: m.avatarColor }}>
                        {m.name[0].toUpperCase()}
                      </div>
                      <span className="text-[11px] font-medium truncate" style={{ color: 'rgba(200,195,240,0.7)' }}>{m.name}</span>
                      <span className="text-[11px] font-bold ml-auto shrink-0" style={{ color: m.avatarColor }}>
                        {paid > 0 ? formatCurrency(paid, group.currency) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <div className="px-4 pt-4 flex flex-col gap-3 pb-28">
        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setAddMemberOpen(true)}
            className="flex items-center justify-center gap-1.5 py-3 rounded-2xl tap text-xs font-semibold"
            style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.25)', color: 'rgba(200,195,240,0.85)' }}
          >
            <UserPlus size={14} className="text-brand" /> Add Member
          </button>
          <button
            onClick={() => setAddExpenseOpen(true)}
            className="flex items-center justify-center gap-1.5 py-3 rounded-2xl tap text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#7c5cfc,#a855f7)' }}
          >
            <Plus size={14} /> Add Expense
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || expenses.length === 0}
            className="flex items-center justify-center gap-1.5 py-3 rounded-2xl tap text-xs font-semibold transition-opacity"
            style={{ background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', color: 'rgba(0,200,150,0.9)', opacity: (exporting || expenses.length === 0) ? 0.5 : 1 }}
          >
            <Download size={14} className={exporting ? 'animate-pulse' : ''} />
            {exporting ? 'Saving…' : 'Export'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {(['expenses', 'balances', 'reports'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2.5 text-xs font-semibold rounded-xl tap transition-all capitalize',
                tab === t ? 'grad-brand text-white' : 'text-2'
              )}
            >
              {t === 'expenses' ? 'Expenses' : t === 'balances' ? 'Balances' : 'Reports'}
            </button>
          ))}
        </div>

        {tab === 'expenses' ? (
          <>
            {/* Month navigator */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setSelectedMonth(m => subMonths(m, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl tap"
                style={{ background: 'var(--bg-card2)' }}
              >
                <ChevronLeft size={16} className="text-2" />
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-1">{format(selectedMonth, 'MMMM yyyy')}</p>
                <p className="text-xs text-3">
                  {monthExpenses.filter(e => e.notes !== '__settlement__').length} expense{monthExpenses.filter(e => e.notes !== '__settlement__').length !== 1 ? 's' : ''}
                  {monthTotal > 0 && <span className="ml-1.5 font-semibold text-expense">· {formatCurrency(monthTotal, group.currency)}</span>}
                </p>
              </div>
              <button
                onClick={() => setSelectedMonth(m => addMonths(m, 1))}
                disabled={isCurrentMonth}
                className="w-9 h-9 flex items-center justify-center rounded-xl tap"
                style={{ background: 'var(--bg-card2)', opacity: isCurrentMonth ? 0.3 : 1 }}
              >
                <ChevronRight size={16} className="text-2" />
              </button>
            </div>

            {monthExpenses.length === 0 ? (
              expenses.length === 0
                ? <EmptyState icon="💸" title="No expenses yet" description="Add the first expense to start tracking." />
                : <EmptyState icon="📅" title={`No expenses in ${format(selectedMonth, 'MMMM')}`} description="Try navigating to a different month." />
            ) : (
              <div className="flex flex-col gap-3">
                {monthExpenses.map(e => (
                  <GroupExpenseCard
                    key={e.id} expense={e} members={group.members} currency={group.currency}
                    categories={categories}
                    onEdit={() => setEditExpense(e)}
                    onDelete={() => deleteGroupExpense(group.id, e.id)}
                    onSettle={(memberId) => settleUp(group.id, e.id, memberId)}
                    onUnsettle={(memberId) => unsettle(group.id, e.id, memberId)}
                    onInvalidate={e.notes === '__settlement__' ? () => updateGroupExpense(group.id, e.id, { invalidated: true }) : undefined}
                  />
                ))}
              </div>
            )}
          </>
        ) : tab === 'balances' ? (
          <BalancesView
            balances={balances}
            members={group.members}
            currency={group.currency}
            expenses={expenses}
            groupId={group.id}
            addGroupExpense={addGroupExpense}
          />
        ) : (
          <GroupReports expenses={expenses} members={group.members} categories={categories} currency={group.currency} settings={settings} />
        )}

        {/* Share code (if shared) */}
        {group.shareCode && (
          <div className="card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Share2 size={13} className="text-brand" />
              <p className="text-xs font-semibold text-1">Invite Code</p>
              {group.isOwner && (
                <button onClick={handleUnshare} className="ml-auto flex items-center gap-1 text-[10px] font-semibold tap" style={{ color: 'rgba(255,107,107,0.8)' }}>
                  <ShieldOff size={10} /> Stop
                </button>
              )}
            </div>
            <p className="text-xs text-2">
              {group.isOwner ? 'Share this code so others can join.' : 'You joined via invite.'}
            </p>
            <ShareCodeRow code={group.shareCode} />
          </div>
        )}

        <Button variant="danger" size="sm" onClick={handleArchive}>
          Archive Group
        </Button>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Trash2 size={14} /> Delete Group
        </Button>
      </div>

      <Modal open={addExpenseOpen} onClose={() => setAddExpenseOpen(false)} title="Add Expense">
        <ExpenseForm group={group} onClose={() => { setAddExpenseOpen(false); loadGroupExpenses(group.id) }} />
      </Modal>

      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense">
        {editExpense && (
          <EditGroupExpenseForm
            group={group}
            expense={editExpense}
            categories={categories}
            onClose={() => { setEditExpense(null); loadGroupExpenses(group.id) }}
            onSave={async (data) => {
              await updateGroupExpense(group.id, editExpense.id, data)
              // Keep the linked personal expense in sync (single source of truth)
              const linked = await expenseQueries.getByLinkedGroupExpense(editExpense.id)
              if (linked) {
                await expenseQueries.update(linked.id, {
                  notes: data.description,
                  ...(data.amount !== undefined && { amount: data.amount }),
                  ...(data.date !== undefined && { date: data.date }),
                  ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
                })
                useExpenseStore.getState().load()
              }
              await loadGroupExpenses(group.id)
              setEditExpense(null)
              toast.success('Expense updated')
            }}
          />
        )}
      </Modal>

      <Modal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Add Member" size="sm">
        <AddMemberForm onClose={() => setAddMemberOpen(false)} onAdd={async (name, email) => {
          await addMember(group.id, name, email)
          toast.success('Member added')
          setAddMemberOpen(false)
        }} />
      </Modal>

      <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)} title="Group Shared!" size="sm">
        <div className="p-4 flex flex-col gap-4 pb-6">
          <p className="text-sm text-2">Share this invite code with your group members. They can join using the "Join Group" button.</p>
          {group.shareCode && <ShareCodeRow code={group.shareCode} large />}
          <p className="text-xs text-3 text-center">Anyone with this code and a Google account can join and sync.</p>
          <Button onClick={() => setShareModalOpen(false)}>Done</Button>
        </div>
      </Modal>

      <Modal open={groupSettingsOpen} onClose={() => setGroupSettingsOpen(false)} title="Group Settings">
        <EditGroupSettingsForm
          group={group}
          onClose={() => setGroupSettingsOpen(false)}
          onSave={async (data) => {
            await updateGroup(group.id, data)
            setGroupSettingsOpen(false)
            toast.success('Group updated')
          }}
        />
      </Modal>
    </div>
  )
}

// ─── Edit Group Settings Form ─────────────────────────────────────────
function EditGroupSettingsForm({ group, onClose, onSave }: {
  group: Group
  onClose: () => void
  onSave: (data: Partial<Group>) => Promise<void>
}) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [currency, setCurrency] = useState(group.currency)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    await onSave({ name: name.trim(), description: description.trim() || undefined, currency })
    setLoading(false)
  }

  const currencyChanged = currency !== group.currency

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[10px] font-bold text-3 uppercase tracking-wider block mb-1.5">Group Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-3 uppercase tracking-wider block mb-1.5">Description</label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-3 uppercase tracking-wider block mb-1.5">Default Currency</label>
          <Select
            options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} — ${c.name}` }))}
            value={currency}
            onChange={e => setCurrency(e.target.value)}
          />
          {currencyChanged && (
            <div className="mt-2 px-3 py-2 rounded-xl text-[11px] leading-relaxed"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.9)' }}>
              ⚠️ Changing currency affects new expenses only. Past expenses keep their recorded amounts — balances and totals will display in the new currency.
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3 mt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} loading={loading} className="flex-1" disabled={!name.trim()}>Save</Button>
      </div>
    </div>
  )
}

// ─── Group Expense Card ───────────────────────────────────────────────
function GroupExpenseCard({ expense, members, currency, categories, onEdit, onDelete, onSettle, onUnsettle, onInvalidate }: {
  expense: GroupExpense
  members: Group['members']
  currency: string
  categories: import('@/core/types').Category[]
  onEdit: () => void
  onDelete: () => void
  onSettle: (memberId: string) => void
  onUnsettle: (memberId: string) => void
  onInvalidate?: () => void
}) {
  // Settlement payment record — solid card with Void option
  if (expense.notes === '__settlement__') {
    const debtor = members.find(m => m.id === expense.paidBy)
    const creditor = members.find(m => m.id === expense.splits[0]?.memberId)
    const voided = expense.invalidated === true
    return (
      <div className={cn('card overflow-hidden', voided && 'opacity-60')}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: voided ? 'rgba(255,255,255,0.06)' : 'rgba(0,200,150,0.12)' }}>
            💸
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn('text-sm font-semibold text-1', voided && 'line-through text-3')}>
                {debtor?.name} paid {creditor?.name}
              </p>
              {voided && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0"
                  style={{ background: 'rgba(255,107,107,0.12)', color: 'rgba(255,107,107,0.75)' }}>
                  Voided
                </span>
              )}
            </div>
            <p className="text-[10px] mt-0.5 text-3">
              Settlement · {expense.date ? format(new Date(expense.date), 'MMM d, h:mm a') : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-sm font-bold tabular-nums', voided ? 'text-3 line-through' : 'text-income')}>
              {formatCurrency(expense.amount, currency)}
            </span>
            {!voided && onInvalidate && (
              <button
                onClick={onInvalidate}
                className="tap text-[10px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,107,107,0.07)', color: 'rgba(255,107,107,0.65)', border: '1px solid rgba(255,107,107,0.15)' }}>
                Void
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const cat = categories.find(c => c.id === expense.categoryId)
  const payer = members.find(m => m.id === expense.paidBy)
  const settledCount = expense.splits.filter(s => s.settled).length
  const totalCount = expense.splits.length
  const settledPct = totalCount > 0 ? Math.round((settledCount / totalCount) * 100) : 0

  return (
    <div className="card overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            {cat && (
              <span className="text-xs px-2 py-0.5 rounded-lg font-medium shrink-0"
                style={{ background: `${cat.color}20`, color: cat.color }}>
                {cat.icon} {cat.name}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-1">{expense.description}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(200,195,240,0.5)' }}>
            Paid by <span style={{ color: payer?.avatarColor ?? 'var(--brand)' }}>{payer?.name ?? 'Unknown'}</span>
            {expense.date ? ` · ${format(new Date(expense.date), 'MMM d, h:mm a')}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0 ml-3 flex flex-col items-end gap-1">
          <p className="text-base font-bold" style={{ color: '#f0eeff' }}>{formatCurrency(expense.amount, currency)}</p>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="text-[10px] tap font-medium" style={{ color: 'rgba(124,92,252,0.8)' }}>Edit</button>
            <button onClick={onDelete} className="text-[10px] tap" style={{ color: 'rgba(255,107,107,0.6)' }}>Remove</button>
          </div>
          {expense.updatedAt && (
            <p className="text-[9px]" style={{ color: 'rgba(200,195,240,0.3)' }}>
              edited {format(new Date(expense.updatedAt), 'MMM d, h:mm a')}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mx-4" style={{ background: 'var(--border)' }} />

      {/* Split rows */}
      <div className="px-4 py-2 flex flex-col gap-2">
        {expense.splits.map(split => {
          const member = members.find(m => m.id === split.memberId)
          const settledByMember = members.find(m => m.id === split.settledBy)
          return (
            <div key={split.memberId}>
              <div className="flex items-center gap-3 py-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: member?.avatarColor ?? '#7c5cfc' }}
                >
                  {member?.name[0].toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-1">{member?.name}</p>
                  {/* Settlement log */}
                  {split.settled && split.settledAt && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(0,200,150,0.6)' }}>
                      Settled {format(new Date(split.settledAt), 'MMM d, h:mm a')}
                      {settledByMember && settledByMember.id !== split.memberId ? ` · by ${settledByMember.name}` : ''}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold text-1 mr-1">{formatCurrency(split.amount, currency)}</span>
                {split.settled ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(0,200,150,0.12)', color: '#00c896' }}>
                      ✓ Settled
                    </span>
                    {/* Undo button */}
                    <button
                      onClick={() => onUnsettle(split.memberId)}
                      className="text-[10px] font-semibold px-1.5 py-1 rounded-lg tap"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(200,195,240,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
                      title="Undo settlement"
                    >
                      ↩
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onSettle(split.memberId)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg tap"
                    style={{ background: 'rgba(124,92,252,0.15)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.25)' }}
                  >
                    Settle Up
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Settled progress bar */}
      <div className="px-4 pb-4 pt-1">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(200,195,240,0.45)' }}>{settledPct}% Settled</span>
          <span className="text-[10px]" style={{ color: 'rgba(200,195,240,0.35)' }}>{settledCount}/{totalCount}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${settledPct}%`,
              background: settledPct === 100 ? '#00c896' : 'linear-gradient(90deg,#7c5cfc,#a855f7)'
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Balances View ────────────────────────────────────────────────────
function BalancesView({ balances, members, currency, expenses, groupId, addGroupExpense }: {
  balances: Record<string, number>
  members: Group['members']
  currency: string
  expenses: GroupExpense[]
  groupId: string
  addGroupExpense: (data: Omit<GroupExpense, 'id' | 'createdAt'>) => Promise<GroupExpense>
}) {
  const sym = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency[0]
  const [settleTarget, setSettleTarget] = useState<{ debtorId: string; creditorId: string } | null>(null)
  const [partialAmt, setPartialAmt] = useState('')
  const [settling, setSettling] = useState(false)

  const entries = members.map(m => ({ member: m, balance: balances[m.id] ?? 0 }))

  // Compute debts accounting for existing settlement payment records
  const debts = useMemo(() => {
    const debtMap: Record<string, Record<string, number>> = {}
    // Pass 1: sum unsettled splits from regular expenses
    for (const e of expenses) {
      if (e.notes === '__settlement__') continue
      for (const s of e.splits) {
        if (!s.settled && s.memberId !== e.paidBy && s.amount > 0) {
          if (!debtMap[s.memberId]) debtMap[s.memberId] = {}
          debtMap[s.memberId][e.paidBy] = (debtMap[s.memberId][e.paidBy] ?? 0) + s.amount
        }
      }
    }
    // Pass 2: subtract active (non-invalidated) settlement payments
    for (const e of expenses) {
      if (e.notes !== '__settlement__' || e.invalidated) continue
      const creditorId = e.splits[0]?.memberId
      if (creditorId && debtMap[e.paidBy]?.[creditorId] !== undefined) {
        debtMap[e.paidBy][creditorId] = Math.max(0, (debtMap[e.paidBy][creditorId] ?? 0) - e.amount)
      }
    }
    const result: { debtorId: string; creditorId: string; amount: number }[] = []
    for (const [debtorId, creditors] of Object.entries(debtMap)) {
      for (const [creditorId, amount] of Object.entries(creditors)) {
        if (amount > 0.005) result.push({ debtorId, creditorId, amount })
      }
    }
    return result.sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const debtAmount = settleTarget
    ? (debts.find(d => d.debtorId === settleTarget.debtorId && d.creditorId === settleTarget.creditorId)?.amount ?? 0)
    : 0
  const partialNum = parseFloat(partialAmt) || 0

  const recordPayment = async (debtorId: string, creditorId: string, amount: number) => {
    const debtor = members.find(m => m.id === debtorId)!
    const creditor = members.find(m => m.id === creditorId)!
    await addGroupExpense({
      groupId,
      description: `💸 ${debtor.name} paid ${creditor.name}`,
      amount,
      currency,
      paidBy: debtorId,
      splits: [{ memberId: creditorId, amount, settled: true, settledAt: Date.now(), settledBy: debtorId }],
      date: Date.now(),
      notes: '__settlement__',
    })
  }

  const handleSettleAll = async () => {
    if (!settleTarget || settling || debtAmount <= 0) return
    setSettling(true)
    await recordPayment(settleTarget.debtorId, settleTarget.creditorId, debtAmount)
    setSettling(false)
    setSettleTarget(null)
  }

  const handleSettlePartial = async () => {
    if (!settleTarget || settling || partialNum <= 0 || partialNum > debtAmount + 0.01) return
    setSettling(true)
    await recordPayment(settleTarget.debtorId, settleTarget.creditorId, partialNum)
    setSettling(false)
    setPartialAmt('')
    setSettleTarget(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Net Balances — compact */}
      <div className="card p-3">
        <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Net Balances</p>
        {entries.length === 0 ? (
          <p className="text-sm text-2 text-center py-3">No members added yet</p>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {entries.map(({ member, balance }) => (
              <div key={member.id} className="flex items-center gap-2.5 py-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: member.avatarColor }}>
                  {member.name[0].toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-1 flex-1 truncate">{member.name}</span>
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0',
                  balance > 0 ? 'text-income' : balance < 0 ? 'text-expense' : 'text-3'
                )} style={{
                  background: balance > 0 ? 'rgba(0,200,150,0.1)' : balance < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)'
                }}>
                  {balance > 0 ? 'is owed' : balance < 0 ? 'owes' : 'settled'}
                </span>
                <span className={cn('text-sm font-bold tabular-nums shrink-0', balance > 0 ? 'text-income' : balance < 0 ? 'text-expense' : 'text-3')}>
                  {balance !== 0 ? `${balance > 0 ? '+' : ''}${formatCurrency(Math.abs(balance), currency)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settle Up */}
      {debts.length === 0 ? (
        <div className="card px-4 py-5 flex items-center gap-3">
          <span className="text-xl shrink-0">🎉</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#00c896' }}>All settled up!</p>
            <p className="text-[11px] text-3">No outstanding balances</p>
          </div>
        </div>
      ) : (
        <div className="card p-3">
          <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Settle Up</p>
          <div className="flex flex-col gap-1.5">
            {debts.map(({ debtorId, creditorId, amount }) => {
              const debtor = members.find(m => m.id === debtorId)
              const creditor = members.find(m => m.id === creditorId)
              if (!debtor || !creditor) return null
              const isOpen = settleTarget?.debtorId === debtorId && settleTarget?.creditorId === creditorId
              return (
                <div key={`${debtorId}-${creditorId}`}
                  className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-card2)', border: `1.5px solid ${isOpen ? 'rgba(124,92,252,0.4)' : 'var(--border)'}` }}>

                  {/* Debt row */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: debtor.avatarColor }}>
                      {debtor.name[0].toUpperCase()}
                    </div>
                    <ArrowRight size={11} className="text-3 shrink-0" />
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: creditor.avatarColor }}>
                      {creditor.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 ml-0.5">
                      <p className="text-[11px] font-semibold text-1 truncate">{debtor.name} → {creditor.name}</p>
                      <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: '#ef4444' }}>{sym}{amount.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => { setSettleTarget(isOpen ? null : { debtorId, creditorId }); setPartialAmt('') }}
                      className="px-2.5 py-1 rounded-lg tap text-[10px] font-bold shrink-0"
                      style={isOpen
                        ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)', border: '1px solid var(--border)' }
                        : { background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.3)' }}>
                      {isOpen ? 'Cancel' : 'Settle'}
                    </button>
                  </div>

                  {/* Settle panel */}
                  {isOpen && (
                    <div className="border-t border-ui px-3 pb-3 pt-2.5 flex flex-col gap-2">
                      <button
                        onClick={handleSettleAll}
                        disabled={settling}
                        className="w-full py-2.5 rounded-xl text-sm font-bold tap"
                        style={{ background: 'linear-gradient(135deg,#00c896,#00a87a)', color: '#fff', opacity: settling ? 0.6 : 1 }}>
                        {settling ? 'Recording…' : `✓ Settle All — ${sym}${debtAmount.toFixed(2)}`}
                      </button>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1.5 rounded-xl px-3 py-2"
                          style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}>
                          <span className="text-sm font-bold shrink-0" style={{ color: 'rgba(124,92,252,0.5)' }}>{sym}</span>
                          <input
                            type="number" inputMode="decimal" placeholder="Partial amount"
                            value={partialAmt}
                            onChange={e => setPartialAmt(e.target.value)}
                            className="flex-1 bg-transparent text-sm font-bold text-1 outline-none placeholder:text-3 min-w-0"
                          />
                        </div>
                        <button
                          onClick={handleSettlePartial}
                          disabled={settling || partialNum <= 0 || partialNum > debtAmount + 0.01}
                          className="px-3 py-2 rounded-xl tap text-sm font-bold shrink-0"
                          style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--brand)', border: '1.5px solid rgba(124,92,252,0.3)', opacity: (settling || partialNum <= 0) ? 0.45 : 1 }}>
                          Record
                        </button>
                      </div>

                      {partialNum > 0 && partialNum <= debtAmount && (
                        <p className="text-[10px] text-3">
                          {sym}{partialNum.toFixed(2)} will be recorded · {sym}{Math.max(0, debtAmount - partialNum).toFixed(2)} remaining
                        </p>
                      )}
                      {partialNum > debtAmount + 0.01 && (
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--expense)' }}>Exceeds outstanding balance</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Group Reports ────────────────────────────────────────────────────
function GroupReports({ expenses, members, categories, currency, settings }: {
  expenses: GroupExpense[]
  members: Group['members']
  categories: import('@/core/types').Category[]
  currency: string
  settings: import('@/core/types').AppSettings
}) {
  const fmt = (v: number) => formatCurrency(v, currency, settings.showCents)
  const regularExpenses = expenses.filter(e => e.notes !== '__settlement__')
  const total = regularExpenses.reduce((s, e) => s + e.amount, 0)

  // Per-member spend
  const memberSpend = useMemo(() => members.map(m => ({
    member: m,
    paid: regularExpenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0),
    owes: regularExpenses.flatMap(e => e.splits).filter(s => s.memberId === m.id && !s.settled).reduce((s, sp) => s + sp.amount, 0),
  })), [expenses, members])

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => {
      if (e.categoryId) map[e.categoryId] = (map[e.categoryId] ?? 0) + e.amount
    })
    return Object.entries(map)
      .map(([id, amount]) => ({ cat: categories.find(c => c.id === id), amount }))
      .filter(x => x.cat)
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, categories])

  const donutData = byCategory.length > 0
    ? byCategory.map(x => ({ name: x.cat!.name, value: x.amount, color: x.cat!.color }))
    : [{ name: 'No data', value: 1, color: '#2d2650' }]

  if (expenses.length === 0) {
    return <EmptyState icon={<BarChart2 size={40} />} title="No data yet" description="Add expenses to see group reports." />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Summary card */}
      <div className="card p-4">
        <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">Group Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(124,92,252,0.1)' }}>
            <p className="text-[10px] text-brand font-semibold uppercase tracking-wide mb-1">Total Spent</p>
            <p className="text-lg font-bold text-1">{fmt(total)}</p>
            <p className="text-[10px] text-3">{regularExpenses.length} expenses</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,107,107,0.1)' }}>
            <p className="text-[10px] text-expense font-semibold uppercase tracking-wide mb-1">Unsettled</p>
            <p className="text-lg font-bold text-1">
              {fmt(expenses.flatMap(e => e.splits).filter(s => !s.settled).reduce((s, sp) => s + sp.amount, 0))}
            </p>
            <p className="text-[10px] text-3">{expenses.flatMap(e => e.splits).filter(s => !s.settled).length} pending</p>
          </div>
        </div>
      </div>

      {/* Who paid what */}
      <div className="card p-4">
        <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">Per Member</p>
        <div className="flex flex-col gap-3">
          {memberSpend.map(({ member, paid, owes }) => {
            const pct = total > 0 ? (paid / total) * 100 : 0
            return (
              <div key={member.id}>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: member.avatarColor }}>
                    {member.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-1">{member.name}</p>
                    <p className="text-[10px] text-3">Paid {fmt(paid)}{owes > 0 ? ` · Owes ${fmt(owes)}` : ' · All settled'}</p>
                  </div>
                  <span className="text-xs font-bold" style={{ color: member.avatarColor }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: member.avatarColor }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By category */}
      {byCategory.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">By Category</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative shrink-0 w-[80px] h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={24} outerRadius={38} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {byCategory.slice(0, 4).map(({ cat, amount }) => {
                const pct = total > 0 ? (amount / total) * 100 : 0
                return (
                  <div key={cat!.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-medium text-2">{cat!.icon} {cat!.name}</span>
                      <span className="text-[11px] font-bold text-1">{fmt(amount)}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat!.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Edit Group Expense Form ──────────────────────────────────────────
function EditGroupExpenseForm({ group, expense, categories, onClose, onSave }: {
  group: Group
  expense: GroupExpense
  categories: import('@/core/types').Category[]
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
          <span className="text-sm shrink-0">📅</span>
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
                  className={cn('px-3 py-1 rounded-xl text-xs font-semibold tap transition-all',
                    editSplitType === t ? 'grad-brand text-white' : 'bg-card2 text-2')}>
                  {t === 'equal' ? '⚖️ Equal' : '✏️ Custom'}
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
                        <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#00c896' }}>✓ Settled</p>
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
                          <span className="text-[11px] shrink-0 font-semibold" style={{ color: '#00c896' }}>✓</span>
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
          <span className="text-sm shrink-0">📝</span>
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
              {receipt ? '✓ Receipt attached' : 'Attach receipt'}
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
            <span className="text-sm shrink-0">{PAYMENT_METHOD_ICONS[paymentMethod]}</span>
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
                  {PAYMENT_METHOD_ICONS[value]} {label}
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

// ─── Add Member Form ──────────────────────────────────────────────────
function AddMemberForm({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, email?: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <Input label="Name" placeholder="e.g. Alice" value={name} onChange={e => setName(e.target.value)} />
      <Input label="Email (optional)" placeholder="alice@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button loading={loading} onClick={async () => { setLoading(true); await onAdd(name.trim(), email.trim() || undefined) }} className="flex-1">Add</Button>
      </div>
    </div>
  )
}

// ─── Share Code Row ───────────────────────────────────────────────────
function ShareCodeRow({ code, large }: { code: string; large?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.25)' }}
    >
      <p className={cn('flex-1 font-mono break-all text-brand', large ? 'text-xs' : 'text-[10px]')}>{code}</p>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-xs font-semibold tap shrink-0 px-2 py-1 rounded-lg"
        style={{ background: 'rgba(124,92,252,0.15)' }}
      >
        {copied ? <Check size={12} className="text-income" /> : <Copy size={12} className="text-brand" />}
        <span className={copied ? 'text-income' : 'text-brand'}>{copied ? 'Copied!' : 'Copy'}</span>
      </button>
    </div>
  )
}

// ─── Join Group Form ──────────────────────────────────────────────────
function JoinGroupForm({ onClose }: { onClose: () => void }) {
  const { joinGroup } = useGroupStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    const shareCode = code.trim()
    if (!shareCode) return
    setLoading(true)
    try {
      const group = await joinGroup(shareCode)
      toast.success(`Joined "${group.name}"!`)
      onClose()
    } catch (e) {
      toast.error((e as Error).message || 'Failed to join group')
    }
    setLoading(false)
  }

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <div>
        <p className="text-sm text-2 mb-3">
          Ask the group owner for their invite code, then paste it below.
          You need to be connected to Google Drive (Settings → Cloud Sync) to join.
        </p>
        <Input
          label="Invite Code"
          placeholder="Paste the invite code here"
          value={code}
          onChange={e => setCode(e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button loading={loading} onClick={handleJoin} className="flex-1">
          <LogIn size={15} /> Join
        </Button>
      </div>
    </div>
  )
}
