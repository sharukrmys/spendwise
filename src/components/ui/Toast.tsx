import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/core/utils'
import { generateId } from '@/core/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  add: (message: string, type?: ToastType, duration?: number) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info', duration = 3500) => {
    const id = generateId()
    set(s => ({ toasts: [...s.toasts, { id, message, type, duration }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), duration)
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().add(msg, 'success'),
  error:   (msg: string) => useToastStore.getState().add(msg, 'error', 5000),
  warning: (msg: string) => useToastStore.getState().add(msg, 'warning'),
  info:    (msg: string) => useToastStore.getState().add(msg, 'info'),
}

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const styles = {
  success: 'border-green-500/30 bg-green-500/10 text-green-300',
  error:   'border-red-500/30   bg-red-500/10   text-red-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  info:    'border-primary-500/30 bg-primary-500/10 text-primary-300',
}

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = icons[t.type]

  useEffect(() => {
    const timer = setTimeout(onRemove, t.duration ?? 3500)
    return () => clearTimeout(timer)
  }, [t.duration, onRemove])

  return (
    <div className={cn(
      'flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg min-w-64 max-w-sm',
      'animate-in slide-in-from-bottom-4 duration-200',
      styles[t.type]
    )}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{t.message}</p>
      <button onClick={onRemove} className="shrink-0 opacity-60 hover:opacity-100 tap">
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
