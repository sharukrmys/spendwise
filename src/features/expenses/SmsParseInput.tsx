import { Clipboard } from 'lucide-react'

/** "Paste bank SMS to auto-fill" pill + the textarea it expands into. */
export function SmsParseInput({
  showInput, onTriggerPaste, smsText, onSmsTextChange, onCancel, onParse,
}: {
  showInput: boolean
  onTriggerPaste: () => void
  smsText: string
  onSmsTextChange: (v: string) => void
  onCancel: () => void
  onParse: () => void
}) {
  if (!showInput) {
    return (
      <div className="flex justify-center mt-1.5">
        <button
          type="button"
          onClick={onTriggerPaste}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full tap"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
        >
          <Clipboard size={11} style={{ color: 'var(--text-3)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>Paste bank SMS to auto-fill</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <textarea
        className="input text-xs resize-none leading-relaxed"
        rows={3}
        placeholder="Paste your bank SMS here…"
        value={smsText}
        onChange={e => onSmsTextChange(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-xl text-xs text-3 tap"
          style={{ background: 'var(--bg-card2)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => smsText.trim() && onParse()}
          className="flex-1 py-1.5 rounded-xl text-xs font-semibold tap"
          style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--brand)' }}
        >
          Parse
        </button>
      </div>
    </div>
  )
}
