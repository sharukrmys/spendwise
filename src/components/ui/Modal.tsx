import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/core/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  showClose?: boolean
}

const sizes = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  full: 'max-w-full h-full rounded-none',
}

export function Modal({ open, onClose, title, children, size = 'md', showClose = true }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={cn(
          'relative w-full border border-ui rounded-t-3xl sm:rounded-2xl',
          'max-h-[92dvh] sm:min-h-0 min-h-[88dvh] flex flex-col overflow-hidden',
          size !== 'full' && sizes[size]
        )}
        style={{ background: 'var(--bg-card)', animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)' }}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-ui shrink-0">
            {title && <h2 className="text-base font-semibold text-1">{title}</h2>}
            {showClose && (
              <button onClick={onClose} className="p-1.5 rounded-lg text-2 hover:text-1 hover:bg-card2 transition-colors tap ml-auto">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div
          className="overflow-y-auto flex-1 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'env(safe-area-inset-bottom)', overflowX: 'hidden' }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes slideUp {
            from { transform: translateY(8px) scale(0.97); opacity: 0; }
            to   { transform: translateY(0)   scale(1);    opacity: 1; }
          }
        }
      `}</style>
    </div>,
    document.body
  )
}

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {children}
    </Modal>
  )
}
