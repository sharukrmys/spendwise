import { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageSpinner } from '@/components/ui/Spinner'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useSettingsStore, applyTheme } from '@/store/useSettingsStore'
import { seedDefaults } from '@/db/schema'
import { handleOAuthCallback } from '@/services/googleSync'

// Lazy-loaded route pages for code splitting
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ExpensesPage  = lazy(() => import('@/features/expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })))
const ReportsPage   = lazy(() => import('@/features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const CalendarPage  = lazy(() => import('@/features/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })))
const GroupsPage    = lazy(() => import('@/features/groups/GroupsPage').then(m => ({ default: m.GroupsPage })))
const SettingsPage  = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))

export default function App() {
  const { load: loadCategories } = useCategoryStore()
  const { load: loadBudgets } = useBudgetStore()
  const { settings } = useSettingsStore()

  useEffect(() => {
    // If this load is the OAuth redirect popup, hand off the token and close.
    if (handleOAuthCallback()) return
    seedDefaults().then(() => {
      loadCategories()
      loadBudgets()
    })
    applyTheme(settings.theme)
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="min-h-dvh bg-base flex items-center justify-center">
          <PageSpinner />
        </div>
      }>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index            element={<DashboardPage />} />
            <Route path="expenses"  element={<ExpensesPage />} />
            <Route path="reports"   element={<ReportsPage />} />
            <Route path="calendar"  element={<CalendarPage />} />
            <Route path="groups"    element={<GroupsPage />} />
            <Route path="settings"  element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
