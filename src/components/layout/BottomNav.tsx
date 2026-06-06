import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Receipt, BarChart2, Plus, MoreHorizontal, Calendar, Users, ListTodo, Settings, Search, X } from 'lucide-react'
import { cn } from '@/core/utils'
import { useTaskStore } from '@/store/useTaskStore'

interface BottomNavProps {
  onAddExpense: () => void
  onAddTask: () => void
  onSearch: () => void
}

const mainLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
]

const rightLinks = [
  { to: '/reports', icon: BarChart2, label: 'Reports' },
]

const moreItems = [
  { to: '/calendar', icon: Calendar, label: 'Calendar', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  { to: '/groups', icon: Users, label: 'Groups', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  { to: '/settings', icon: Settings, label: 'Settings', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
]

export function BottomNav({ onAddExpense, onAddTask, onSearch }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const navigate = useNavigate()
  const overdueCount = useTaskStore(s =>
    s.tasks.filter(t => t.status === 'pending' && t.dueDate != null && t.dueDate < Date.now()).length
  )

  const handleMoreNav = (to: string) => {
    setMoreOpen(false)
    navigate(to)
  }

  return (
    <>
      {/* ── More drawer overlay ── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* ── More drawer ── */}
      {moreOpen && (
        <div
          className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-[88px]"
        >
          <div
            className="w-full max-w-sm mx-2 rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
          >
            <div className="grid grid-cols-4 p-3 gap-2">
              {moreItems.map(item => (
                <button
                  key={item.to}
                  onClick={() => handleMoreNav(item.to)}
                  className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl tap transition-all relative"
                  style={{ background: 'var(--bg-card2)' }}
                >
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: item.bg }}>
                    <item.icon size={20} style={{ color: item.color }} strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-semibold text-2">{item.label}</span>
                  {item.label === 'Tasks' && overdueCount > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ background: '#ff4d4d', fontSize: '8px', lineHeight: 1 }}
                    >
                      {overdueCount > 9 ? '9+' : overdueCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add action sheet ── */}
      {addOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setAddOpen(false)}
        />
      )}
      {addOpen && (
        <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-[88px]">
          <div
            className="w-full max-w-sm mx-2 rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
          >
            <div className="p-3 flex flex-col gap-2">
              <button
                onClick={() => { setAddOpen(false); onSearch() }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl tap"
                style={{ background: 'rgba(77,106,154,0.15)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(77,106,154,0.3)' }}>
                  <Search size={16} style={{ color: '#6b93c4' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-1">Search</p>
                  <p className="text-xs text-3">Find any transaction</p>
                </div>
              </button>
              <button
                onClick={() => { setAddOpen(false); onAddExpense() }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl tap"
                style={{ background: 'rgba(255,107,107,0.1)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,107,107,0.25)' }}>
                  <Receipt size={16} style={{ color: '#ff6b6b' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-1">Add Expense</p>
                  <p className="text-xs text-3">Record a transaction</p>
                </div>
              </button>
              <button
                onClick={() => { setAddOpen(false); onAddTask() }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl tap"
                style={{ background: 'rgba(124,92,252,0.1)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,92,252,0.25)' }}>
                  <ListTodo size={16} style={{ color: '#7c5cfc' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-1">Add Task</p>
                  <p className="text-xs text-3">Create a to-do or checklist</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 flex justify-center items-end pb-3 px-2 nav-h safe-bottom pointer-events-none">
        <nav className="pointer-events-auto w-full max-w-sm glass rounded-2xl flex items-center" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)', padding: '6px 4px' }}>

          {/* Left links */}
          {mainLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn('flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl tap transition-all duration-200', isActive ? 'text-brand' : 'text-2')
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn('relative w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-200', isActive ? 'grad-brand shadow-lg' : '')}>
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'text-white' : ''} />
                  </div>
                  <span className={cn('text-[9px] font-semibold transition-all', isActive ? 'text-brand' : 'text-2')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Center Add button */}
          <button
            onClick={() => { setMoreOpen(false); setAddOpen(v => !v) }}
            className="relative mx-1 w-12 h-12 rounded-2xl flex items-center justify-center tap shrink-0 transition-all duration-200"
            style={{ background: addOpen ? 'linear-gradient(135deg, #a855f7, #7c5cfc)' : 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 4px 20px rgba(124,92,252,0.5)', transform: addOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
            aria-label="Add"
          >
            <Plus size={22} className="text-white" strokeWidth={2.5} />
          </button>

          {/* Right links */}
          {rightLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn('flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl tap transition-all duration-200', isActive ? 'text-brand' : 'text-2')
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn('relative w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-200', isActive ? 'grad-brand shadow-lg' : '')}>
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'text-white' : ''} />
                  </div>
                  <span className={cn('text-[9px] font-semibold transition-all', isActive ? 'text-brand' : 'text-2')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => { setAddOpen(false); setMoreOpen(v => !v) }}
            className={cn('flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl tap transition-all duration-200 relative', moreOpen ? 'text-brand' : 'text-2')}
          >
            <div className={cn('relative w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-200', moreOpen ? 'grad-brand shadow-lg' : '')}>
              {moreOpen
                ? <X size={16} strokeWidth={2.5} className="text-white" />
                : <MoreHorizontal size={16} strokeWidth={1.75} />}
              {!moreOpen && overdueCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: '#ff4d4d', fontSize: '8px', lineHeight: 1 }}
                >
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>
              )}
            </div>
            <span className={cn('text-[9px] font-semibold transition-all', moreOpen ? 'text-brand' : 'text-2')}>More</span>
          </button>

        </nav>
      </div>
    </>
  )
}
