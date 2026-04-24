import { cn } from '@/core/utils'
import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: string
  variant?: 'solid' | 'soft' | 'outline'
  size?: 'sm' | 'md'
}

export function Badge({ children, color = '#6366f1', variant = 'soft', size = 'sm' }: BadgeProps) {
  const style =
    variant === 'solid'
      ? { backgroundColor: color, color: 'white' }
      : variant === 'soft'
      ? { backgroundColor: `${color}20`, color }
      : { borderColor: `${color}60`, color, background: 'transparent' }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        variant !== 'outline' && 'border-transparent',
      )}
      style={style}
    >
      {children}
    </span>
  )
}

interface CategoryBadgeProps {
  icon: string
  name: string
  color: string
}

export function CategoryBadge({ icon, name, color }: CategoryBadgeProps) {
  return (
    <Badge color={color} variant="soft">
      <span className="mr-1">{icon}</span>{name}
    </Badge>
  )
}
