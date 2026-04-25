import { useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash2, Pencil } from 'lucide-react'
import { haptics } from '@/core/haptics'

interface SwipeableRowProps {
  children: React.ReactNode
  onDelete?: () => void
  onEdit?: () => void
  disabled?: boolean
}

const THRESHOLD = 72   // px to trigger action
const PEEK      = 56   // how far the action icon peeks

export function SwipeableRow({ children, onDelete, onEdit, disabled }: SwipeableRowProps) {
  const x = useMotionValue(0)
  const triggered = useRef(false)

  // Left-swipe (negative x) → delete background
  const deleteOpacity = useTransform(x, [-THRESHOLD, -PEEK, 0], [1, 0.6, 0])
  const deleteScale   = useTransform(x, [-THRESHOLD * 1.5, -PEEK, 0], [1.2, 0.9, 0.7])

  // Right-swipe (positive x) → edit background
  const editOpacity   = useTransform(x, [0, PEEK, THRESHOLD], [0, 0.6, 1])
  const editScale     = useTransform(x, [0, PEEK, THRESHOLD * 1.5], [0.7, 0.9, 1.2])

  // Background tint
  const leftBg  = useTransform(x, [-THRESHOLD, 0], ['rgba(255,107,107,0.22)', 'rgba(255,107,107,0)'])
  const rightBg = useTransform(x, [0, THRESHOLD], ['rgba(124,92,252,0)', 'rgba(124,92,252,0.18)'])

  const handleDragEnd = () => {
    const val = x.get()
    if (!triggered.current) {
      if (val < -THRESHOLD && onDelete) {
        triggered.current = true
        haptics.delete()
        animate(x, -window.innerWidth, { duration: 0.25 }).then(() => {
          onDelete()
          animate(x, 0, { duration: 0 })
          triggered.current = false
        })
        return
      }
      if (val > THRESHOLD && onEdit) {
        triggered.current = true
        haptics.light()
        onEdit()
      }
    }
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 })
    triggered.current = false
  }

  if (disabled) return <>{children}</>

  return (
    <div className="relative overflow-hidden">
      {/* Delete hint — right side (swipe left reveals) */}
      {onDelete && (
        <motion.div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 pointer-events-none"
          style={{ background: leftBg, left: 0 }}
        >
          <motion.div style={{ opacity: deleteOpacity, scale: deleteScale }}>
            <Trash2 size={20} style={{ color: '#ff6b6b' }} />
          </motion.div>
        </motion.div>
      )}

      {/* Edit hint — left side (swipe right reveals) */}
      {onEdit && (
        <motion.div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-5 pointer-events-none"
          style={{ background: rightBg, right: 0 }}
        >
          <motion.div style={{ opacity: editOpacity, scale: editScale }}>
            <Pencil size={20} style={{ color: 'var(--brand)' }} />
          </motion.div>
        </motion.div>
      )}

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: onDelete ? -THRESHOLD * 2 : 0, right: onEdit ? THRESHOLD * 2 : 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  )
}
