import { useEffect, useState, useMemo } from 'react'
import { Plus, Users, ArrowRight, UserPlus, Trash2, ChevronLeft, Share2, RefreshCw, Link, LogIn, Copy, Check, ShieldOff, CloudOff, BarChart2, X, Download } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGroupStore } from '@/store/useGroupStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { formatCurrency, cn } from '@/core/utils'
import { CURRENCIES } from '@/core/constants'
import type { Group, GroupExpense } from '@/core/types'
import { toast } from '@/components/ui/Toast'
import { format } from 'date-fns'
import { exportGroupData } from '@/services/exportXlsx'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'

// ─── Group List ──────────────────────────────────────────────────────
export function GroupsPage() {
  const { groups, load } = useGroupStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)

  useEffect(() => { load() }, [])

  // Keep activeGroup in sync when store updates (e.g. after sync)
  useEffect(() => {
    if (activeGroup) {
      const updated = groups.find(g => g.id === activeGroup.id)
      if (updated) setActiveGroup(updated)
    }
  }, [groups])

  if (activeGroup) {
    return <GroupDetail group={activeGroup} onBack={() => setActiveGroup(null)} />
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
            {groups.map(g => <GroupCard key={g.id} group={g} onOpen={() => setActiveGroup(g)} />)}
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
            </div>
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
function GroupCard({ group, onOpen }: { group: Group; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex items-center gap-3 w-full p-4 card tap transition-all">
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
      <ArrowRight size={16} className="text-3 shrink-0" />
    </button>
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
  const { loadGroupExpenses, groupExpenses, deleteGroupExpense, updateGroupExpense, addMember, settleUp, unsettle, getBalances, deleteGroup, shareGroup, syncSharedGroup, unshareGroup, syncingGroupId } = useGroupStore()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<import('@/core/types').GroupExpense | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [tab, setTab] = useState<'expenses' | 'balances' | 'reports'>('expenses')
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
  const balances = getBalances(group.id)
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  const handleDelete = async () => {
    await deleteGroup(group.id)
    onBack()
    toast.success('Group deleted')
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
        {/* Top bar: back + sharing badge */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="flex items-center gap-1 text-sm tap" style={{ color: 'rgba(200,195,240,0.7)' }}>
            <ChevronLeft size={16} /> Groups
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
          expenses.length === 0 ? (
            <EmptyState icon="💸" title="No expenses yet" description="Add the first expense to start tracking." />
          ) : (
            <div className="flex flex-col gap-3">
              {expenses.map(e => (
                <GroupExpenseCard
                  key={e.id} expense={e} members={group.members} currency={group.currency}
                  categories={categories}
                  onEdit={() => setEditExpense(e)}
                  onDelete={() => deleteGroupExpense(group.id, e.id)}
                  onSettle={(memberId) => settleUp(group.id, e.id, memberId)}
                  onUnsettle={(memberId) => unsettle(group.id, e.id, memberId)}
                />
              ))}
            </div>
          )
        ) : tab === 'balances' ? (
          <BalancesView balances={balances} members={group.members} currency={group.currency} />
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
    </div>
  )
}

// ─── Group Expense Card ───────────────────────────────────────────────
function GroupExpenseCard({ expense, members, currency, categories, onEdit, onDelete, onSettle, onUnsettle }: {
  expense: GroupExpense
  members: Group['members']
  currency: string
  categories: import('@/core/types').Category[]
  onEdit: () => void
  onDelete: () => void
  onSettle: (memberId: string) => void
  onUnsettle: (memberId: string) => void
}) {
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
function BalancesView({ balances, members, currency }: { balances: Record<string, number>; members: Group['members']; currency: string }) {
  const entries = members.map(m => ({ member: m, balance: balances[m.id] ?? 0 }))

  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-1 mb-3">Who owes whom</p>
      {entries.length === 0 ? (
        <p className="text-sm text-2 text-center py-4">No members added yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(({ member, balance }) => (
            <div key={member.id} className="flex items-center gap-3">
              <div className="w-9 h-9 icon-circle rounded-xl shrink-0 text-sm font-bold text-white" style={{ backgroundColor: member.avatarColor, borderRadius: '0.875rem' }}>
                {member.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-1">{member.name}</p>
                <p className="text-xs text-2">
                  {balance > 0 ? 'is owed' : balance < 0 ? 'owes' : 'settled up'}
                </p>
              </div>
              <span className={cn('text-sm font-bold', balance > 0 ? 'text-income' : balance < 0 ? 'text-expense' : 'text-3')}>
                {balance !== 0 && (balance > 0 ? '+' : '')}{formatCurrency(Math.abs(balance), currency)}
              </span>
            </div>
          ))}
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
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // Per-member spend
  const memberSpend = useMemo(() => members.map(m => ({
    member: m,
    paid: expenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0),
    owes: expenses.flatMap(e => e.splits).filter(s => s.memberId === m.id && !s.settled).reduce((s, sp) => s + sp.amount, 0),
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
            <p className="text-[10px] text-3">{expenses.length} expenses</p>
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
  const [date, setDate] = useState(format(new Date(expense.date), "yyyy-MM-dd'T'HH:mm"))
  const [splits, setSplits] = useState(expense.splits.map(s => ({ ...s, amountStr: s.amount.toString() })))
  const [loading, setLoading] = useState(false)
  const expenseCategories = categories.filter(c => !c.parentId)

  // When a new member needs to be added to this expense
  const addSplitMember = (memberId: string) => {
    if (splits.find(s => s.memberId === memberId)) return
    const newSplit = { memberId, amount: 0, amountStr: '0', settled: false }
    setSplits(prev => [...prev, newSplit])
  }

  const membersNotInSplits = group.members.filter(m => !splits.find(s => s.memberId === m.id))

  const redistributeEqual = () => {
    const total = parseFloat(amount) || 0
    const per = parseFloat((total / splits.length).toFixed(2))
    setSplits(prev => prev.map(s => ({ ...s, amount: per, amountStr: per.toString() })))
  }

  const handleSave = async () => {
    const totalAmount = parseFloat(amount)
    if (!description.trim() || isNaN(totalAmount) || totalAmount <= 0) return
    setLoading(true)
    await onSave({
      description: description.trim(),
      amount: totalAmount,
      categoryId: categoryId || undefined,
      paidBy,
      notes: notes.trim() || undefined,
      date: new Date(date).getTime(),
      splits: splits.map(s => ({
        memberId: s.memberId,
        amount: parseFloat(s.amountStr) || 0,
        settled: s.settled,
        settledAt: s.settledAt,
        settledBy: s.settledBy,
      })),
    })
  }

  return (
    <div className="flex flex-col">
      {/* ─── Sticky top: amount + description ─── */}
      <div className="sticky top-0 z-10 border-b border-ui" style={{ background: 'var(--bg-card)' }}>
        <div className="px-4 pt-3 pb-2 text-center" style={{ background: 'linear-gradient(160deg,#2a1860,#16123a)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(200,195,240,0.5)' }}>
            Edit · {group.currency}
          </p>
          <div className="flex items-center justify-center py-1">
            <input
              type="number" inputMode="decimal" value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-4xl font-bold bg-transparent outline-none text-center w-48"
              style={{ color: '#f0eeff' }}
              autoFocus
            />
          </div>
        </div>
        <div className="px-4 py-3">
          <input
            className="w-full bg-transparent text-sm text-center text-1 outline-none placeholder:text-3"
            placeholder="e.g. Dinner, Taxi…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 pb-6">
        {/* Category */}
        <div>
          <p className="text-xs font-bold text-3 uppercase tracking-wider mb-2">Category</p>
          <div className="grid grid-cols-4 gap-2">
            {expenseCategories.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl tap"
                style={categoryId === c.id
                  ? { background: `${c.color}25`, border: `1.5px solid ${c.color}60` }
                  : { background: 'var(--bg-card2)', border: '1.5px solid transparent' }}>
                <span className="text-xl">{c.icon}</span>
                <span className="text-[10px] font-semibold truncate w-full text-center"
                  style={{ color: categoryId === c.id ? c.color : 'var(--text-3)' }}>
                  {c.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Paid by */}
        <div>
          <p className="text-xs font-bold text-3 uppercase tracking-wider mb-2">Paid by</p>
          <div className="flex gap-2 flex-wrap">
            {group.members.map(m => (
              <button key={m.id} onClick={() => setPaidBy(m.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl tap"
                style={paidBy === m.id
                  ? { background: `${m.avatarColor}25`, border: `1.5px solid ${m.avatarColor}60` }
                  : { background: 'var(--bg-card2)', border: '1.5px solid transparent' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: m.avatarColor }}>
                  {m.name[0].toUpperCase()}
                </div>
                <span className="text-xs font-semibold" style={{ color: paidBy === m.id ? m.avatarColor : 'var(--text-2)' }}>
                  {m.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Splits — editable + add member */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-3 uppercase tracking-wider">Splits</p>
            <button onClick={redistributeEqual} className="text-[11px] font-semibold tap" style={{ color: 'var(--brand)' }}>
              ⚖ Redistribute equally
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {splits.map((split, i) => {
              const member = group.members.find(m => m.id === split.memberId)
              return (
                <div key={split.memberId} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: member?.avatarColor ?? '#7c5cfc' }}>
                    {member?.name[0].toUpperCase() ?? '?'}
                  </div>
                  <span className="text-sm font-medium text-1 flex-1 truncate">{member?.name ?? 'Unknown'}</span>
                  {split.settled ? (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-lg mr-1" style={{ background: 'rgba(0,200,150,0.12)', color: '#00c896' }}>✓ Settled</span>
                  ) : null}
                  <input
                    type="number" inputMode="decimal"
                    value={split.amountStr}
                    onChange={e => setSplits(prev => prev.map((s, j) => j === i ? { ...s, amountStr: e.target.value, amount: parseFloat(e.target.value) || 0 } : s))}
                    className="input w-24 text-right text-sm"
                    disabled={split.settled}
                  />
                  {!split.settled && (
                    <button onClick={() => setSplits(prev => prev.filter((_, j) => j !== i))}
                      className="tap" style={{ color: 'rgba(255,107,107,0.6)' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add member to this expense */}
          {membersNotInSplits.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-3 uppercase tracking-wider mb-2">Add member to this expense</p>
              <div className="flex gap-2 flex-wrap">
                {membersNotInSplits.map(m => (
                  <button key={m.id} onClick={() => addSplitMember(m.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl tap"
                    style={{ background: `${m.avatarColor}15`, border: `1px solid ${m.avatarColor}40` }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: m.avatarColor }}>
                      {m.name[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: m.avatarColor }}>+ {m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <p className="text-xs font-bold text-3 uppercase tracking-wider mb-1.5">Date & Time</p>
          <input type="datetime-local" className="input text-xs" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a note…" />

        <div className="flex gap-3 pb-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={loading} className="flex-1">Save Changes</Button>
        </div>
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
