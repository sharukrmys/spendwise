import { useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { cn } from '@/core/utils'

export function ShareCodeRow({ code, groupName, large }: { code: string; groupName?: string; large?: boolean }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const inviteUrl = `${window.location.origin}/groups?join=${encodeURIComponent(code)}`
  const shareText = groupName
    ? `Join "${groupName}" on SR Expense to split bills together.\n\n${inviteUrl}\n\nOr paste this invite code in the app: ${code}`
    : `Join my group on SR Expense: ${inviteUrl}\n\nOr paste this invite code in the app: ${code}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    try {
      await navigator.share({ title: groupName ? `Join ${groupName}` : 'Join my group', text: shareText })
    } catch {
      // user cancelled the share sheet — no-op
    }
  }

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.25)' }}
    >
      <p className={cn('flex-1 font-mono break-all text-brand', large ? 'text-xs' : 'text-[10px]')}>{code}</p>
      {canShare && (
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-xs font-semibold tap shrink-0 px-2 py-1 rounded-lg"
          style={{ background: 'rgba(124,92,252,0.15)' }}
        >
          <Share2 size={12} className="text-brand" />
          <span className="text-brand">Share</span>
        </button>
      )}
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
