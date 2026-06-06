import { useState, useEffect } from 'react'
import { Delete, Check } from 'lucide-react'
import { cn } from '@/core/utils'

interface NumPadProps {
  value: string
  onChange: (val: string) => void
  onConfirm: () => void
  onClose: () => void
  currencySymbol?: string
  label?: string
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', '.']

export function NumPad({ value, onChange, onConfirm, onClose, currencySymbol = '₹', label }: NumPadProps) {
  const [display, setDisplay] = useState(value || '')

  useEffect(() => { setDisplay(value || '') }, [value])

  const press = (key: string) => {
    if (key === '⌫') {
      const next = display.slice(0, -1)
      setDisplay(next)
      onChange(next)
      return
    }
    // Prevent multiple decimals
    if (key === '.' && display.includes('.')) return
    // Limit to 2 decimal places
    if (display.includes('.')) {
      const decimals = display.split('.')[1]
      if (decimals && decimals.length >= 2) return
    }
    // Prevent leading zeros
    if (key !== '.' && display === '0') {
      setDisplay(key)
      onChange(key)
      return
    }
    const next = display + key
    setDisplay(next)
    onChange(next)
  }

  const numericValue = parseFloat(display) || 0
  const isValid = numericValue > 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 flex justify-center"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div
          className="w-full max-w-sm mx-0 rounded-t-3xl overflow-hidden"
          style={{ background: 'var(--bg-card)', boxShadow: '0 -16px 48px rgba(0,0,0,0.6)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Amount display */}
          <div className="px-6 pt-5 pb-4 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
            {label && <p className="text-xs font-semibold text-3 uppercase tracking-widest mb-2">{label}</p>}
            <div className="flex items-end justify-center gap-1">
              <span
                className="text-3xl font-bold pb-1"
                style={{ color: isValid ? 'var(--text-3)' : 'var(--text-3)' }}
              >
                {currencySymbol}
              </span>
              <span
                className="text-5xl font-bold leading-none"
                style={{ color: isValid ? 'var(--text)' : 'var(--text-3)', minWidth: '4ch', textAlign: 'right' }}
              >
                {display || '0'}
              </span>
            </div>
          </div>

          {/* Keys */}
          <div className="grid grid-cols-3 gap-px p-1" style={{ background: 'var(--border)' }}>
            {KEYS.map(key => (
              <button
                key={key}
                onClick={() => press(key)}
                className={cn(
                  'h-14 flex items-center justify-center text-xl font-semibold tap transition-all active:scale-95',
                )}
                style={{ background: key === '⌫' ? 'var(--bg-card2)' : 'var(--bg-card)' }}
              >
                {key === '⌫'
                  ? <Delete size={20} style={{ color: 'var(--text-2)' }} />
                  : <span style={{ color: 'var(--text)' }}>{key}</span>}
              </button>
            ))}
          </div>

          {/* Confirm button */}
          <div className="p-3 pt-2">
            <button
              onClick={() => { if (isValid) onConfirm() }}
              disabled={!isValid}
              className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white tap transition-all"
              style={{
                background: isValid ? 'linear-gradient(135deg, #7c5cfc, #a855f7)' : 'var(--bg-card2)',
                color: isValid ? 'white' : 'var(--text-3)',
                boxShadow: isValid ? '0 6px 24px rgba(124,92,252,0.4)' : 'none',
              }}
            >
              <Check size={20} />
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
