import { useState } from 'react'
import { LogIn, CloudOff, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useGroupStore } from '@/store/useGroupStore'
import { useSyncStore } from '@/store/useSyncStore'
import { pickSharedGroupFile } from '@/services/googleSync'
import { toast } from '@/components/ui/Toast'
import type { Group } from '@/core/types'

export function JoinGroupForm({ onClose, onJoined, initialCode }: { onClose: () => void; onJoined?: (group: Group) => void; initialCode?: string }) {
  const { joinGroup } = useGroupStore()
  const { enabled: driveConnected, connect, status } = useSyncStore()
  const [code, setCode] = useState(initialCode ?? '')
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [granted, setGranted] = useState(false)
  const connecting = status === 'syncing'

  const handleConnect = async () => {
    await connect()
    const err = useSyncStore.getState().error
    if (err) toast.error(err)
  }

  const handlePick = async () => {
    const shareCode = code.trim()
    if (!shareCode) return
    setPicking(true)
    try {
      const matched = await pickSharedGroupFile(shareCode)
      if (matched) {
        setGranted(true)
        toast.success('Access granted — tap Join to continue')
      } else {
        toast.error("That wasn't the right file — look for the one matching your invite, or ask the owner to add your Google email and re-share.")
      }
    } catch (e) {
      toast.error((e as Error).message || 'Could not open the picker')
    } finally {
      setPicking(false)
    }
  }

  const handleJoin = async () => {
    const shareCode = code.trim()
    if (!shareCode) return
    setLoading(true)
    try {
      const group = await joinGroup(shareCode)
      toast.success(`Joined "${group.name}"`)
      if (onJoined) onJoined(group)
      else onClose()
    } catch (e) {
      toast.error((e as Error).message || 'Failed to join group')
    } finally {
      setLoading(false)
    }
  }

  if (!driveConnected) {
    return (
      <div className="p-4 flex flex-col gap-4 pb-6">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,92,252,0.12)' }}>
            <CloudOff size={22} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-1 mb-1">Connect Google Drive to join</p>
            <p className="text-xs text-2">
              {initialCode
                ? "You've been invited to a shared group. Group data syncs through your own Google Drive — connect it to continue."
                : 'Group sharing syncs through your own Google Drive — connect it to join.'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button loading={connecting} onClick={handleConnect} className="flex-1">Connect Drive</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <div>
        <p className="text-sm text-2 mb-3">
          {initialCode
            ? "You've been invited to join this group. Confirm the invite code below."
            : 'Ask the group owner for their invite code, then paste it below.'}
        </p>
        <Input
          label="Invite Code"
          placeholder="Paste the invite code here"
          value={code}
          onChange={e => { setCode(e.target.value); setGranted(false) }}
        />
      </div>

      {!granted ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-2">
            The owner must have already added your Google email to this group and shared it. Tap below and select the matching file in the picker — that grants this app access to it.
          </p>
          <Button loading={picking} disabled={!code.trim()} onClick={handlePick}>
            <FolderOpen size={15} /> Open Shared File
          </Button>
        </div>
      ) : (
        <p className="text-xs font-semibold" style={{ color: '#00c896' }}>Access granted — ready to join.</p>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button loading={loading} disabled={!granted} onClick={handleJoin} className="flex-1">
          <LogIn size={15} /> Join
        </Button>
      </div>
    </div>
  )
}
