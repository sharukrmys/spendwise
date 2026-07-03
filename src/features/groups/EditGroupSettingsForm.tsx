import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { CURRENCIES } from '@/core/constants'
import type { Group } from '@/core/types'

export function EditGroupSettingsForm({ group, onClose, onSave }: {
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
            <div className="mt-2 px-3 py-2 rounded-xl text-[11px] leading-relaxed flex items-start gap-1.5"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.9)' }}>
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>Changing currency affects new expenses only. Past expenses keep their recorded amounts — balances and totals will display in the new currency.</span>
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
