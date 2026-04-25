import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, BarChart2, Calendar, Users, ListTodo } from 'lucide-react'
import { cn } from '@/core/utils'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/groups', icon: Users, label: 'Groups' },
]

export function BottomNav() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 flex justify-center items-end pb-3 px-2 nav-h safe-bottom pointer-events-none">
      <nav className="pointer-events-auto w-full max-w-sm glass rounded-2xl px-1 py-2 flex justify-around items-center" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl tap transition-all duration-200',
                isActive ? 'text-brand' : 'text-2'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-200',
                  isActive ? 'grad-brand shadow-lg' : ''
                )}>
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className={isActive ? 'text-white' : ''}
                  />
                </div>
                <span className={cn('text-[9px] font-semibold transition-all', isActive ? 'text-brand' : 'text-2')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
