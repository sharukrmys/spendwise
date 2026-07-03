import { useRef, useState } from 'react'
import { Plus, Trash2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useGroupStore } from '@/store/useGroupStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { CURRENCIES } from '@/core/constants'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/core/utils'

interface MemberRow { key: number; name: string; email: string }

export function CreateGroupForm({ onClose }: { onClose: () => void }) {
  const { addGroup, addMember, setMyMember } = useGroupStore()
  const { settings } = useSettingsStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [members, setMembers] = useState<MemberRow[]>([{ key: 0, name: settings.myGroupName ?? '', email: '' }])
  const [meIndex, setMeIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const nextKey = useRef(1)

  const updateMember = (idx: number, patch: Partial<MemberRow>) =>
    setMembers(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const addRow = () => {
    setMembers(rows => [...rows, { key: nextKey.current++, name: '', email: '' }])
  }

  const removeRow = (idx: number) => {
    setMembers(rows => rows.filter((_, i) => i !== idx))
    if (meIndex === idx) setMeIndex(-1)
    else if (meIndex > idx) setMeIndex(m => m - 1)
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const group = await addGroup(name.trim(), description.trim() || undefined, currency)
      const validRows = members.filter(m => m.name.trim())
      let meMemberId: string | undefined
      for (let i = 0; i < members.length; i++) {
        const row = members[i]
        if (!row.name.trim()) continue
        const created = await addMember(group.id, row.name.trim(), row.email.trim() || undefined)
        if (i === meIndex) meMemberId = created.id
      }
      if (meMemberId) await setMyMember(group.id, meMemberId)
      toast.success(`Group created with ${validRows.length} member${validRows.length !== 1 ? 's' : ''}`)
      onClose()
    } catch {
      toast.error('Failed to create group')
      setLoading(false)
    }
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

      <div>
        <label className="text-sm font-medium text-2 pl-1 block mb-2">Members</label>
        <div className="flex flex-col gap-2">
          {members.map((row, idx) => (
            <div key={row.key} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMeIndex(meIndex === idx ? -1 : idx)}
                title="This is me"
                className={cn('w-9 h-9 flex items-center justify-center rounded-xl tap shrink-0')}
                style={meIndex === idx
                  ? { background: 'rgba(124,92,252,0.18)', color: 'var(--brand)', border: '1.5px solid rgba(124,92,252,0.4)' }
                  : { background: 'var(--bg-card2)', color: 'var(--text-3)', border: '1.5px solid var(--border)' }}
              >
                <UserCheck size={14} />
              </button>
              <Input placeholder="Name" value={row.name} onChange={e => updateMember(idx, { name: e.target.value })} className="flex-1" />
              <Input placeholder="Email (optional)" type="email" value={row.email} onChange={e => updateMember(idx, { email: e.target.value })} className="flex-1" />
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl tap shrink-0"
                  style={{ background: 'rgba(255,107,107,0.08)', color: 'rgba(255,107,107,0.75)' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-3 mt-1.5 pl-1">Tap the badge to mark yourself — sets up your balance on the group list.</p>
        <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-xs font-semibold tap mt-2.5 px-1" style={{ color: 'var(--brand)' }}>
          <Plus size={14} /> Add another member
        </button>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={handleCreate} loading={loading} className="flex-1" disabled={!name.trim()}>Create</Button>
      </div>
    </div>
  )
}
