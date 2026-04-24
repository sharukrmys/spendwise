import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings } from 'lucide-react'
import { cn } from '@/core/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: boolean
  right?: ReactNode
  showSettings?: boolean
  className?: string
}

export function PageHeader({ title, subtitle, back, right, showSettings, className }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={cn(
      'sticky top-0 z-30 glass border-b border-ui',
      'px-4 py-3 flex items-center gap-3',
      className
    )}>
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-1 rounded-xl text-2 hover:text-1 hover:bg-card2 transition-colors tap"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-1 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-2 truncate">{subtitle}</p>}
      </div>

      {right}

      {showSettings && (
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl text-2 hover:text-1 hover:bg-card2 transition-colors tap"
        >
          <Settings size={20} />
        </button>
      )}
    </header>
  )
}
