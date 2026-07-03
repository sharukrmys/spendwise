/**
 * Web Push / Notification service.
 * Uses the Notifications API (no server required — local notifications only
 * since we have no push server). Checks budget and overdue tasks on demand.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

export function notify(title: string, body: string, icon = '/pwa-192x192.png') {
  if (!canNotify()) return
  try {
    new Notification(title, { body, icon, badge: icon })
  } catch {
    // Some browsers block notifications outside of SW context; silently ignore
  }
}

export function notifyBudgetAlert(spent: number, budget: number, currency: string) {
  const pct = (spent / budget) * 100
  if (pct >= 100) {
    notify('Budget exceeded', `You've spent ${currency} ${spent.toFixed(0)} — ${(pct - 100).toFixed(0)}% over your ${currency} ${budget.toFixed(0)} budget.`)
  } else if (pct >= 85) {
    notify('Budget warning', `You've used ${pct.toFixed(0)}% of your ${currency} ${budget.toFixed(0)} monthly budget.`)
  }
}

export function notifyOverdueTasks(count: number) {
  if (count <= 0) return
  notify(
    `${count} overdue task${count > 1 ? 's' : ''}`,
    count === 1 ? 'You have 1 overdue task.' : `You have ${count} overdue tasks waiting.`
  )
}
