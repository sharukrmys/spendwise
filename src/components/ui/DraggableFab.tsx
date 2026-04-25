import { useState, useRef, useCallback, useEffect, type PointerEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'

interface FabAction {
  icon: ReactNode
  label: string
  onClick: () => void
  color?: string
}

interface DraggableFabProps {
  onClick?: () => void
  actions?: FabAction[]
}

export function DraggableFab({ onClick, actions }: DraggableFabProps) {
  const [pos, setPos] = useState({ x: -20, y: -108 })
  const [hidden, setHidden] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const dragging = useRef(false)
  const moved = useRef(false)
  const startPointer = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const fabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const check = () => setHidden(document.body.style.overflow === 'hidden')
    const obs = new MutationObserver(check)
    obs.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (hidden) setExpanded(false)
  }, [hidden])

  const onPointerDown = useCallback((e: PointerEvent) => {
    dragging.current = true
    moved.current = false
    startPointer.current = { x: e.clientX, y: e.clientY }
    startPos.current = { ...pos }
    fabRef.current?.setPointerCapture(e.pointerId)
  }, [pos])

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - startPointer.current.x
    const dy = e.clientY - startPointer.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true
    if (!moved.current) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const newX = Math.max(-vw + 70, Math.min(startPos.current.x + dx, -16))
    const newY = Math.max(-vh + 70, Math.min(startPos.current.y + dy, -120))
    setPos({ x: newX, y: newY })
  }, [])

  const onPointerUp = useCallback((e: PointerEvent) => {
    dragging.current = false
    fabRef.current?.releasePointerCapture(e.pointerId)
    if (!moved.current) {
      if (actions) {
        setExpanded(v => !v)
      } else {
        onClick?.()
      }
    }
    if (moved.current) {
      const vw = window.innerWidth
      const fabCenterX = vw + pos.x - 28
      setPos(prev => ({
        ...prev,
        x: fabCenterX < vw / 2 ? -(vw - 56) : -20,
      }))
      setExpanded(false)
    }
  }, [onClick, actions, pos.x])

  if (hidden) return null

  // FAB size = 56px (w-14). Action icons = 48px (w-12).
  // Right-aligning both: FAB and icons share the same right edge → no horizontal overlap.
  // Actions render BEFORE the FAB in DOM so they sit above it in the flex column.
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        touchAction: 'none',
      }}
    >
      {/* Speed-dial actions — rendered first so they appear above the FAB */}
      {actions && expanded && (
        <div className="flex flex-col gap-2.5 items-end pb-1">
          {[...actions].reverse().map((action) => (
            <button
              key={action.label}
              onClick={() => { action.onClick(); setExpanded(false) }}
              className="flex items-center gap-2.5 tap"
              style={{ pointerEvents: 'auto' }}
            >
              <span
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border2)',
                  color: 'var(--text-2)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                }}
              >
                {action.label}
              </span>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg shrink-0"
                style={{ background: action.color ?? 'var(--brand)' }}
              >
                <span className="text-white">{action.icon}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        ref={fabRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fab w-14 h-14"
        style={{ touchAction: 'none' }}
      >
        {actions && expanded
          ? <X size={22} className="text-white" />
          : <Plus size={24} className="text-white" />}
      </button>
    </div>
  )
}
