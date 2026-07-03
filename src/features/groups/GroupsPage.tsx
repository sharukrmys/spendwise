import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Users, LogIn, ChevronDown, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGroupStore } from '@/store/useGroupStore'
import { cn } from '@/core/utils'
import type { Group, GroupExpense } from '@/core/types'
import { toast } from '@/components/ui/Toast'
import { GroupCard } from './GroupCard'
import { CreateGroupForm } from './CreateGroupForm'
import { JoinGroupForm } from './JoinGroupForm'
import { GroupDetail } from './GroupDetail'

// ─── Group List ──────────────────────────────────────────────────────
export function GroupsPage() {
  const { groups, load, setActiveGroup: setStoreActiveGroup, unarchiveGroup, addGroup, addGroupExpense, loadGroupExpenses, groupExpenses } = useGroupStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const joinCode = searchParams.get('join') ?? undefined

  // Deep link from a shared invite: /groups?join=<code> immediately prompts to join
  useEffect(() => {
    if (joinCode) setJoinOpen(true)
  }, [joinCode])

  const closeJoin = () => {
    setJoinOpen(false)
    if (joinCode) setSearchParams(prev => { prev.delete('join'); return prev }, { replace: true })
  }

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

      <Modal open={joinOpen} onClose={closeJoin} title="Join a Group" size="sm">
        <JoinGroupForm
          initialCode={joinCode}
          onClose={() => { closeJoin(); load() }}
          onJoined={(group) => { closeJoin(); load(); openGroup(group) }}
        />
      </Modal>
    </div>
  )
}
