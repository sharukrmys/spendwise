import { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageSkeleton } from '@/components/ui/Spinner'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useSettingsStore, applyTheme } from '@/store/useSettingsStore'
import { useTaskStore } from '@/store/useTaskStore'
import { seedDefaults } from '@/db/schema'
import { handleOAuthCallback } from '@/services/googleSync'
import { processRecurringExpenses } from '@/services/recurringProcessor'
import { notifyBudgetAlert, notifyOverdueTasks, canNotify } from '@/services/notifications'
import { expenseQueries } from '@/db/queries'
import { getMonthRange } from '@/core/utils'

// Lazy-loaded route pages for code splitting
const DashboardPage  = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ExpensesPage   = lazy(() => import('@/features/expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })))
const ReportsPage    = lazy(() => import('@/features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const CalendarPage   = lazy(() => import('@/features/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })))
const GroupsPage     = lazy(() => import('@/features/groups/GroupsPage').then(m => ({ default: m.GroupsPage })))
const SettingsPage   = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const TasksPage      = lazy(() => import('@/features/tasks/TasksPage').then(m => ({ default: m.TasksPage })))
const ShareTargetPage = lazy(() => import('@/features/share/ShareTargetPage').then(m => ({ default: m.ShareTargetPage })))

export default function App() {
  const { load: loadCategories } = useCategoryStore()
  const { load: loadBudgets } = useBudgetStore()
  const { settings } = useSettingsStore()
  const { load: loadTasks } = useTaskStore()

  useEffect(() => {
    if (handleOAuthCallback()) return
    seedDefaults().then(async () => {
      loadCategories()
      await loadBudgets()
      processRecurringExpenses().catch(console.error)

      if (settings.notifications && canNotify()) {
        // Budget alert
        const budgetList = useBudgetStore.getState().budgets
        const monthly = budgetList.find(b => !b.categoryId && b.period === 'monthly')
        if (monthly) {
          const r = getMonthRange()
          const spent = await expenseQueries.getTotal(r.start, r.end)
          notifyBudgetAlert(spent, monthly.amount, monthly.currency)
        }

        // Overdue tasks
        await loadTasks()
        const now = Date.now()
        const overdue = useTaskStore.getState().tasks.filter(
          t => t.status === 'pending' && t.dueDate && t.dueDate < now
        )
        notifyOverdueTasks(overdue.length)
      }
    })
    applyTheme(settings.theme, settings.accentColor)
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index                element={<DashboardPage />} />
            <Route path="expenses"      element={<ExpensesPage />} />
            <Route path="reports"       element={<ReportsPage />} />
            <Route path="calendar"      element={<CalendarPage />} />
            <Route path="groups"        element={<GroupsPage />} />
            <Route path="tasks"         element={<TasksPage />} />
            <Route path="settings"      element={<SettingsPage />} />
            <Route path="share-target"  element={<ShareTargetPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
