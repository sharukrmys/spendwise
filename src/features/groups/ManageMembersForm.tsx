import { useState } from 'react'
import { Trash2, UserCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/core/utils'
import { useGroupStore } from '@/store/useGroupStore'
import { toast } from '@/components/ui/Toast'
import type { Group, GroupExpense } from '@/core/types'

export function ManageMembersForm({ group, expenses, onClose }: {
  group: Group
  expenses: GroupExpense[]
  onClose: () => void
}) {
  const { addMember, removeMember, setMyMember } = useGroupStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const hasActivity = (memberId: string) =>
    expenses.some(e => e.paidBy === memberId || e.splits.some(s => s.memberId === memberId && s.amount > 0))

  const handleAdd = async () => {
    if (!name.trim()) return
    setAdding(true)
    await addMember(group.id, name.trim(), email.trim() || undefined)
    setName('')
    setEmail('')
    setAdding(false)
    toast.success('Member added')
  }

  const handleRemove = async (memberId: string) => {
    if (hasActivity(memberId)) {
      toast.error('Can’t remove — this member has expenses. Remove or reassign those first.')
      return
    }
    await removeMember(group.id, memberId)
    toast.success('Member removed')
  }

  const handleSetMe = async (memberId: string) => {
    await setMyMember(group.id, group.myMemberId === memberId ? undefined : memberId)
  }

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <p className="text-xs text-3">
        Mark which member is you — this drives your balance badge on the group list. Members with expense history can't be removed.
      </p>

      <div className="flex flex-col gap-2">
        {group.members.length === 0 && (
          <p className="text-sm text-2 text-center py-3">No members yet — add the first one below.</p>
        )}
        {group.members.map(m => {
          const isMe = group.myMemberId === m.id
          const locked = hasActivity(m.id)
          return (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--bg-card2)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: m.avatarColor }}>
                {m.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-1 truncate">{m.name}</p>
                  {isMe && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0"
                      style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--brand)' }}>
                      You
                    </span>
                  )}
                </div>
                {m.email && <p className="text-[11px] text-3 truncate">{m.email}</p>}
              </div>
              <button
                onClick={() => handleSetMe(m.id)}
                title={isMe ? 'Unmark as me' : 'This is me'}
                className="w-8 h-8 flex items-center justify-center rounded-lg tap shrink-0"
                style={isMe
                  ? { background: 'rgba(124,92,252,0.15)', color: 'var(--brand)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-3)' }}>
                <UserCheck size={14} />
              </button>
              <button
                onClick={() => handleRemove(m.id)}
                disabled={locked}
                title={locked ? 'Has expense history' : 'Remove member'}
                className={cn('w-8 h-8 flex items-center justify-center rounded-lg tap shrink-0', locked && 'opacity-30')}
                style={{ background: 'rgba(255,107,107,0.08)', color: 'rgba(255,107,107,0.75)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 pt-1 border-t border-ui">
        <p className="text-[10px] font-bold text-3 uppercase tracking-wider pt-3">Add Member</p>
        <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <Input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Button loading={adding} disabled={!name.trim()} onClick={handleAdd}>
          <UserPlus size={15} /> Add
        </Button>
      </div>

      <Button variant="ghost" onClick={onClose}>Done</Button>
    </div>
  )
}
