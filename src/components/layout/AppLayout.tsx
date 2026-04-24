import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { ToastContainer } from '@/components/ui/Toast'
import { DraggableFab } from '@/components/ui/DraggableFab'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { useExpenseStore } from '@/store/useExpenseStore'

export function AppLayout() {
  const [addOpen, setAddOpen] = useState(false)
  const { load } = useExpenseStore()
  const location = useLocation()
  const showFab = location.pathname !== '/expenses'

  return (
    <div className="min-h-dvh bg-base flex flex-col max-w-lg mx-auto relative">
      <main className="flex-1 page-bottom overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
      {showFab && <DraggableFab onClick={() => setAddOpen(true)} />}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Transaction">
        <ExpenseForm onClose={() => { setAddOpen(false); load() }} />
      </Modal>
      <ToastContainer />
    </div>
  )
}
