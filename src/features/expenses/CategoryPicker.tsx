import { X } from 'lucide-react'
import { cn } from '@/core/utils'
import type { Category } from '@/core/types'
import { QUICK_COLORS } from './expenseFormHelpers'

export function CategoryPicker({
  categories, categoryId, onSelect, error,
  showQuickAdd, onToggleQuickAdd,
  newCatName, onNewCatNameChange,
  newCatIcon, onNewCatIconChange,
  newCatColor, onNewCatColorChange,
  onQuickAddSubmit,
}: {
  categories: Category[]
  categoryId: string
  onSelect: (id: string) => void
  error?: string
  showQuickAdd: boolean
  onToggleQuickAdd: (open: boolean) => void
  newCatName: string
  onNewCatNameChange: (v: string) => void
  newCatIcon: string
  onNewCatIconChange: (v: string) => void
  newCatColor: string
  onNewCatColorChange: (v: string) => void
  onQuickAddSubmit: () => void
}) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map(c => (
          <button key={c.id} onClick={() => onSelect(c.id)}
            className={cn('flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap transition-all',
              categoryId === c.id ? '' : 'bg-card2'
            )}
            style={categoryId === c.id
              ? { background: `${c.color}18`, outline: `1.5px solid ${c.color}55`, minWidth: 64 }
              : { minWidth: 64 }}>
            <span className="text-2xl leading-none">{c.icon}</span>
            <span className="text-[10px] font-semibold text-2 truncate" style={{ maxWidth: 56, color: categoryId === c.id ? c.color : undefined }}>
              {c.name.split(' ')[0]}
            </span>
          </button>
        ))}
        {!showQuickAdd && (
          <button onClick={() => onToggleQuickAdd(true)}
            className="flex flex-col items-center gap-1.5 pt-2.5 pb-2 px-3 rounded-2xl shrink-0 tap bg-card2"
            style={{ minWidth: 64 }}>
            <span className="text-2xl leading-none text-brand">+</span>
            <span className="text-[10px] font-semibold text-3">New</span>
          </button>
        )}
      </div>
      {error && <p className="text-xs mt-1" style={{ color: 'var(--expense)' }}>{error}</p>}

      {showQuickAdd && (
        <div className="mt-2 p-3 rounded-xl bg-card2 flex flex-col gap-2">
          <div className="flex gap-2">
            <input placeholder="📦" value={newCatIcon} onChange={e => onNewCatIconChange(e.target.value)}
              className="input w-12 text-center text-lg py-1.5" />
            <input placeholder="Category name" value={newCatName} onChange={e => onNewCatNameChange(e.target.value)}
              className="input flex-1 text-sm py-1.5" onKeyDown={e => e.key === 'Enter' && onQuickAddSubmit()} />
            <button onClick={() => onToggleQuickAdd(false)} className="tap text-3 p-1"><X size={14} /></button>
          </div>
          <div className="flex items-center gap-2">
            {QUICK_COLORS.map(c => (
              <button key={c} onClick={() => onNewCatColorChange(c)}
                className={cn('w-5 h-5 rounded-full tap shrink-0', newCatColor === c && 'ring-2 ring-offset-1 ring-white')}
                style={{ backgroundColor: c }} />
            ))}
            <button onClick={onQuickAddSubmit} className="ml-auto btn btn-brand text-xs py-1 px-3 rounded-lg">Add</button>
          </div>
        </div>
      )}
    </div>
  )
}
