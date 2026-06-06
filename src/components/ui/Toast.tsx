import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { generateId } from '@/core/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastStore {
  toasts: Toast[]
  add: (message: string, type?: ToastType, duration?: number, action?: Toast['action']) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info', duration = 3500, action) => {
    const id = generateId()
    set(s => ({ toasts: [...s.toasts, { id, message, type, duration, action }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), duration)
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().add(msg, 'success'),
  error: (msg: string) => useToastStore.getState().add(msg, 'error', 5000),
  warning: (msg: string) => useToastStore.getState().add(msg, 'warning'),
  info: (msg: string) => useToastStore.getState().add(msg, 'info'),
  undo: (msg: string, onUndo: () => void) =>
    useToastStore.getState().add(msg, 'warning', 5000, { label: 'Undo', onClick: onUndo }),
}

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const typeConfig = {
  success: {
    bg: 'rgba(10,28,20,0.97)',
    border: 'rgba(0,200,150,0.35)',
    iconColor: '#00c896',
    textColor: '#d1fae5',
    accent: '#00c896',
    shadow: 'rgba(0,200,150,0.18)',
  },
  error: {
    bg: 'rgba(28,10,10,0.97)',
    border: 'rgba(255,107,107,0.35)',
    iconColor: '#ff6b6b',
    textColor: '#fee2e2',
    accent: '#ff6b6b',
    shadow: 'rgba(255,107,107,0.18)',
  },
  warning: {
    bg: 'rgba(25,16,4,0.97)',
    border: 'rgba(245,158,11,0.35)',
    iconColor: '#f59e0b',
    textColor: '#fef3c7',
    accent: '#f59e0b',
    shadow: 'rgba(245,158,11,0.18)',
  },
  info: {
    bg: 'rgba(12,10,28,0.97)',
    border: 'rgba(124,92,252,0.35)',
    iconColor: '#a78bfa',
    textColor: '#ede9fe',
    accent: '#7c5cfc',
    shadow: 'rgba(124,92,252,0.18)',
  },
}

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = icons[t.type]
  const cfg = typeConfig[t.type]

  useEffect(() => {
    const timer = setTimeout(onRemove, t.duration ?? 3500)
    return () => clearTimeout(timer)
  }, [t.duration, onRemove])

  return (
    <div
      className="flex items-center gap-3 rounded-2xl min-w-72 max-w-xs animate-in slide-in-from-bottom-4 duration-200"
      style={{
        background: cfg.bg,
        border: `1.5px solid ${cfg.border}`,
        boxShadow: `0 8px 32px ${cfg.shadow}, 0 2px 8px rgba(0,0,0,0.4)`,
        borderLeft: `4px solid ${cfg.accent}`,
        padding: '12px 14px',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Icon size={18} className="shrink-0" style={{ color: cfg.iconColor }} />
      <p className="text-sm font-medium flex-1" style={{ color: cfg.textColor }}>{t.message}</p>
      {t.action && (
        <button
          onClick={() => { onRemove(); t.action!.onClick() }}
          className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl tap ml-1"
          style={{ background: `${cfg.accent}25`, color: cfg.iconColor, border: `1px solid ${cfg.border}` }}
        >
          {t.action.label}
        </button>
      )}
      <button onClick={onRemove} className="shrink-0 tap opacity-50 hover:opacity-90" style={{ color: cfg.textColor }}>
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={() => remove(t.id)} />
      ))}
    </div>
  )
}
