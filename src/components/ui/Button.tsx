import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/core/utils'

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'grad-brand text-white font-semibold shadow-lg shadow-brand/25',
  ghost:   'bg-card2 text-2 border border-ui hover:border-ui2 hover:text-1',
  danger:  'bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20',
  success: 'bg-income/10 text-income border border-income/20 hover:bg-income/20',
  outline: 'bg-transparent border border-brand/50 text-brand hover:bg-brand/10',
}

const sizes: Record<Size, string> = {
  sm:   'px-3 py-1.5 text-sm rounded-xl',
  md:   'px-4 py-2.5 text-sm rounded-xl',
  lg:   'px-6 py-3.5 text-base rounded-2xl',
  icon: 'p-2.5 rounded-xl aspect-square',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 tap',
        'disabled:opacity-40 disabled:cursor-not-allowed active:scale-95',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
