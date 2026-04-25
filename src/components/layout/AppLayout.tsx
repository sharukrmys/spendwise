import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { ToastContainer } from '@/components/ui/Toast'
import { DraggableFab } from '@/components/ui/DraggableFab'
import { GlobalSearch } from '@/components/ui/GlobalSearch'
import { OnboardingWizard } from '@/components/ui/OnboardingWizard'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { TaskForm } from '@/features/tasks/TaskForm'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useTaskStore } from '@/store/useTaskStore'
import { Receipt, ListTodo, Search } from 'lucide-react'

export function AppLayout() {
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { load: loadExpenses } = useExpenseStore()
  const { load: loadTasks } = useTaskStore()
  const location = useLocation()
  const hideFab = location.pathname === '/expenses' || location.pathname === '/tasks'

  const fabActions = [
    { icon: <Search size={16} />,   label: 'Search',  onClick: () => setSearchOpen(true),   color: '#4d6a9a' },
    { icon: <Receipt size={16} />,  label: 'Expense', onClick: () => setAddExpenseOpen(true), color: '#ff6b6b' },
    { icon: <ListTodo size={16} />, label: 'Task',    onClick: () => setAddTaskOpen(true),    color: '#7c5cfc' },
  ]

  return (
    <div className="min-h-dvh bg-base flex flex-col max-w-lg mx-auto relative">
      <main className="flex-1 page-bottom overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
      {!hideFab && <DraggableFab actions={fabActions} />}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Modal open={addExpenseOpen} onClose={() => setAddExpenseOpen(false)} title="Add Transaction">
        <ExpenseForm onClose={() => { setAddExpenseOpen(false); loadExpenses() }} />
      </Modal>
      <Modal open={addTaskOpen} onClose={() => setAddTaskOpen(false)} title="New Task">
        <TaskForm onClose={() => { setAddTaskOpen(false); loadTasks() }} />
      </Modal>
      <OnboardingWizard />
      <ToastContainer />
    </div>
  )
}
