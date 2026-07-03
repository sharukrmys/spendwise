import { Hash, X } from 'lucide-react'
import type { Tag } from '@/core/types'

export function TagPicker({
  allTags, selectedTagIds, onToggleTag, tagInput, onTagInputChange, onAddTag,
}: {
  allTags: Tag[]
  selectedTagIds: string[]
  onToggleTag: (id: string) => void
  tagInput: string
  onTagInputChange: (v: string) => void
  onAddTag: () => void
}) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-card2">
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => {
            const active = selectedTagIds.includes(tag.id)
            return (
              <button key={tag.id} onClick={() => onToggleTag(tag.id)}
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
            placeholder="Add tag…" value={tagInput} onChange={e => onTagInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddTag() } }} />
        </div>
        {tagInput.trim() && (
          <button onClick={onAddTag}
            className="w-8 h-8 flex items-center justify-center rounded-xl tap"
            style={{ background: 'var(--brand)', color: '#fff' }}>
            <Hash size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
