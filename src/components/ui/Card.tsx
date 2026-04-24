import { type ReactNode } from 'react'
import { cn } from '@/core/utils'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  gradient?: 'primary' | 'success' | 'danger'
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const paddings = { sm: 'p-3', md: 'p-4', lg: 'p-5', none: '' }
const gradients = {
  primary: 'grad-brand border-0 text-white',
  success: 'grad-income border-0 text-white',
  danger:  'bg-expense/10 border border-expense/20',
}

export function Card({ children, className, onClick, gradient, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'card overflow-hidden',
        paddings[padding],
        gradient && gradients[gradient],
        onClick && 'cursor-pointer tap active:scale-[0.98] transition-all',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon?: ReactNode
  trend?: number
  gradient?: CardProps['gradient']
}

export function StatCard({ label, value, sub, icon, trend, gradient }: StatCardProps) {
  const isGrad = !!gradient
  return (
    <Card gradient={gradient}>
      <div className="flex items-start justify-between mb-3">
        <p className={cn('text-xs font-medium uppercase tracking-wide', isGrad ? 'text-white/70' : 'text-3')}>
          {label}
        </p>
        {icon && (
          <span className={cn('text-lg', isGrad ? 'opacity-80' : 'text-3')}>{icon}</span>
        )}
      </div>
      <p className={cn('text-2xl font-bold', isGrad ? 'text-white' : 'text-1')}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span className={cn('text-xs font-medium flex items-center gap-0.5',
            trend >= 0 ? (isGrad ? 'text-white/80' : 'text-income') : (isGrad ? 'text-white/80' : 'text-expense')
          )}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <p className={cn('text-xs', isGrad ? 'text-white/60' : 'text-3')}>{sub}</p>}
      </div>
    </Card>
  )
}
