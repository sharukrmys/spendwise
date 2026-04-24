import { useState, useRef, useCallback, useEffect, type PointerEvent } from 'react'
import { Plus } from 'lucide-react'

interface DraggableFabProps {
  onClick: () => void
}

export function DraggableFab({ onClick }: DraggableFabProps) {
  const [pos, setPos] = useState({ x: -20, y: -108 }) // offset from bottom-right
  const [hidden, setHidden] = useState(false)
  const dragging = useRef(false)
  const moved = useRef(false)
  const startPointer = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const fabRef = useRef<HTMLButtonElement>(null)

  // Hide whenever ANY modal locks the body scroll (e.g. Modal, bottom sheets)
  useEffect(() => {
    const check = () => setHidden(document.body.style.overflow === 'hidden')
    const obs = new MutationObserver(check)
    obs.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    return () => obs.disconnect()
  }, [])

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
    // pos is negative offset from bottom-right
    const newX = Math.max(-vw + 70, Math.min(startPos.current.x - dx, -16))
    const newY = Math.max(-vh + 70, Math.min(startPos.current.y - dy, -100))
    setPos({ x: newX, y: newY })
  }, [])

  const onPointerUp = useCallback((e: PointerEvent) => {
    dragging.current = false
    fabRef.current?.releasePointerCapture(e.pointerId)
    if (!moved.current) onClick()

    // Snap to nearest horizontal edge
    if (moved.current) {
      const vw = window.innerWidth
      const fabCenterX = vw + pos.x + 28 // 28 = half of 56px fab
      setPos(prev => ({
        ...prev,
        x: fabCenterX < vw / 2 ? -(vw - 20) + 56 : -20,
      }))
    }
  }, [onClick, pos.x])

  if (hidden) return null

  return (
    <button
      ref={fabRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fab w-14 h-14"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: 50,
        touchAction: 'none',
      }}
    >
      <Plus size={24} className="text-white" />
    </button>
  )
}
