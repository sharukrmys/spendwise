import { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageSkeleton } from '@/components/ui/Spinner'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useSettingsStore, applyTheme } from '@/store/useSettingsStore'
import { useTaskStore } from '@/store/useTaskStore'
import { useGroupStore } from '@/store/useGroupStore'
import { seedDefaults } from '@/db/schema'
import { handleOAuthCallback } from '@/services/googleSync'
import { processRecurringExpenses } from '@/services/recurringProcessor'
import { notifyBudgetAlert, notifyOverdueTasks, canNotify } from '@/services/notifications'
import { expenseQueries } from '@/db/queries'
import { getMonthRange } from '@/core/utils'
import { toast } from '@/components/ui/Toast'

// Lazy-loaded route pages for code splitting
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ExpensesPage = lazy(() => import('@/features/expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })))
const GroupsPage = lazy(() => import('@/features/groups/GroupsPage').then(m => ({ default: m.GroupsPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then(m => ({ default: m.TasksPage })))
const ShareTargetPage = lazy(() => import('@/features/share/ShareTargetPage').then(m => ({ default: m.ShareTargetPage })))
const SubscriptionsPage = lazy(() => import('@/features/subscriptions/SubscriptionsPage').then(m => ({ default: m.SubscriptionsPage })))
const QuickAddPage = lazy(() => import('@/features/quick-add/QuickAddPage').then(m => ({ default: m.QuickAddPage })))

export default function App() {
  const { load: loadCategories } = useCategoryStore()
  const { load: loadBudgets } = useBudgetStore()
  const { settings } = useSettingsStore()
  const { load: loadTasks } = useTaskStore()
  const { load: loadGroups, loadAllGroupExpenses } = useGroupStore()

  useEffect(() => {
    if (handleOAuthCallback()) return
    seedDefaults().then(async () => {
      loadCategories()
      await loadBudgets()
      await loadGroups()
      loadAllGroupExpenses().catch(console.error)

      // Process recurring expenses and notify user if any were created
      const created = await processRecurringExpenses().catch(() => 0)
      if (created > 0) {
        setTimeout(() => {
          toast.success(`${created} recurring expense${created > 1 ? 's' : ''} added automatically`)
        }, 1500)
      }

      if (settings.notifications && canNotify()) {
        // Budget alert — only when budget feature is enabled
        if (settings.enableBudgets) {
          const budgetList = useBudgetStore.getState().budgets
          const monthly = budgetList.find(b => !b.categoryId && b.period === 'monthly')
          if (monthly) {
            const r = getMonthRange()
            const spent = await expenseQueries.getTotal(r.start, r.end)
            notifyBudgetAlert(spent, monthly.amount, monthly.currency)
          }
        }

        // Overdue tasks
        await loadTasks()
        const now = Date.now()
        const overdue = useTaskStore.getState().tasks.filter(
          t => t.status === 'pending' && t.dueDate && t.dueDate < now
        )
        notifyOverdueTasks(overdue.length)
      }

      // App Badging API — show 7-day expense count on icon
      if ('setAppBadge' in navigator) {
        try {
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
          const weekExpenses = await expenseQueries.getByRange(weekAgo, Date.now())
          const count = weekExpenses.filter(e => e.type !== 'income').length
          if (count > 0) {
            (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count)
          } else {
            (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge?.()
          }
        } catch { /* Badging API not supported */ }
      }
    })
    applyTheme(settings.theme, settings.accentColor)
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="share-target" element={<ShareTargetPage />} />
          </Route>
          {/* Quick-add: standalone page without nav chrome for home screen shortcut */}
          <Route path="quick-add" element={<QuickAddPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
