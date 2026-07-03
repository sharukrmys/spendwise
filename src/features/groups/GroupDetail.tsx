import { useEffect, useState, useMemo } from 'react'
import { Trash2, ChevronLeft, ChevronRight, Share2, RefreshCw, UserPlus, Plus, CloudOff, ShieldOff, Download, Settings, Wallet, CalendarDays } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useGroupStore } from '@/store/useGroupStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { formatCurrency, cn } from '@/core/utils'
import type { Group, GroupExpense } from '@/core/types'
import { expenseQueries } from '@/db/queries'
import { useExpenseStore } from '@/store/useExpenseStore'
import { toast } from '@/components/ui/Toast'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns'
import { exportGroupData } from '@/services/exportXlsx'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { EmptyState } from '@/components/ui/EmptyState'
import { GroupExpenseCard } from './GroupExpenseCard'
import { BalancesView } from './BalancesView'
import { GroupReports } from './GroupReports'
import { EditGroupExpenseForm } from './EditGroupExpenseForm'
import { ManageMembersForm } from './ManageMembersForm'
import { ShareCodeRow } from './ShareCodeRow'
import { EditGroupSettingsForm } from './EditGroupSettingsForm'

export function GroupDetail({ group, onBack }: { group: Group; onBack: () => void }) {
  const { loadGroupExpenses, groupExpenses, deleteGroupExpense, updateGroupExpense, addGroupExpense, settleUp, unsettle, getBalances, deleteGroup, updateGroup, shareGroup, syncSharedGroup, unshareGroup, syncingGroupId, archiveGroup } = useGroupStore()
  const { categories } = useCategoryStore()
  const { settings } = useSettingsStore()
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<GroupExpense | null>(null)
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
      toast.success('Group shared. Copy the invite code.')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleSync = async () => {
    try {
      await syncSharedGroup(group.id)
      await loadGroupExpenses(group.id)
      toast.success('Group synced')
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
              <Settings size={10} style={{ color: 'rgba(200,195,240,0.7)' }} />
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(200,195,240,0.7)' }}>Settings</span>
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
                      {group.myMemberId === m.id && (
                        <span className="text-[8px] font-bold px-1 py-px rounded uppercase tracking-wider shrink-0"
                          style={{ background: 'rgba(124,92,252,0.2)', color: '#c4b5fd' }}>
                          You
                        </span>
                      )}
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
            <UserPlus size={14} className="text-brand" /> Members
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
                ? <EmptyState icon={<Wallet size={36} />} title="No expenses yet" description="Add the first expense to start tracking." />
                : <EmptyState icon={<CalendarDays size={36} />} title={`No expenses in ${format(selectedMonth, 'MMMM')}`} description="Try navigating to a different month." />
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
            <ShareCodeRow code={group.shareCode} groupName={group.name} />
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

      <Modal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} title="Members" size="sm">
        <ManageMembersForm group={group} expenses={expenses} onClose={() => setAddMemberOpen(false)} />
      </Modal>

      <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)} title="Group Shared" size="sm">
        <div className="p-4 flex flex-col gap-4 pb-6">
          <p className="text-sm text-2">Share this invite code with your group members. They can join using the "Join Group" button.</p>
          {group.shareCode && <ShareCodeRow code={group.shareCode} groupName={group.name} large />}
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
