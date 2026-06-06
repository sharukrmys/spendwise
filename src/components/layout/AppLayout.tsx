import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { ToastContainer } from '@/components/ui/Toast'
import { GlobalSearch } from '@/components/ui/GlobalSearch'
import { OnboardingWizard } from '@/components/ui/OnboardingWizard'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { TaskForm } from '@/features/tasks/TaskForm'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useTaskStore } from '@/store/useTaskStore'
import { useGroupStore } from '@/store/useGroupStore'
import { useLocation } from 'react-router-dom'

export function AppLayout() {
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { load: loadExpenses } = useExpenseStore()
  const { load: loadTasks } = useTaskStore()
  const { activeGroupId, loadGroupExpenses, groups } = useGroupStore()
  const location = useLocation()
  const onGroupPage = location.pathname === '/groups'
  const activeGroup = onGroupPage && activeGroupId ? (groups.find(g => g.id === activeGroupId) ?? null) : null

  return (
    <div className="min-h-dvh bg-base flex flex-col max-w-lg mx-auto relative">
      <main className="flex-1 page-bottom overflow-y-auto">
        <Outlet />
      </main>

      <BottomNav
        onAddExpense={() => setAddExpenseOpen(true)}
        onAddTask={() => setAddTaskOpen(true)}
        onSearch={() => setSearchOpen(true)}
      />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Modal
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        title={activeGroup ? `Add to ${activeGroup.name}` : 'Add Transaction'}
      >
        <ExpenseForm
          group={activeGroup ?? undefined}
          onClose={() => {
            setAddExpenseOpen(false)
            loadExpenses()
            if (activeGroupId) loadGroupExpenses(activeGroupId)
          }}
        />
      </Modal>

      <Modal open={addTaskOpen} onClose={() => setAddTaskOpen(false)} title="New Task">
        <TaskForm onClose={() => { setAddTaskOpen(false); loadTasks() }} />
      </Modal>

      <OnboardingWizard />
      <ToastContainer />
    </div>
  )
}
