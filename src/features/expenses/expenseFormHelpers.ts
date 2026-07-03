import type { PaymentMethod } from '@/core/types'
import { PAYMENT_METHOD_LABELS } from '@/core/constants'

export { compressImage } from '@/utils/image'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value: value as PaymentMethod, label })
)

export const QUICK_COLORS = ['#7c5cfc', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#ef4444', '#f97316', '#8b5cf6']

const RECENT_CATS_KEY = 'em-recent-cats'
export function getRecentCatIds(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_CATS_KEY) ?? '[]') } catch { return [] }
}
export function saveRecentCatId(id: string) {
  const updated = [id, ...getRecentCatIds().filter(r => r !== id)].slice(0, 8)
  localStorage.setItem(RECENT_CATS_KEY, JSON.stringify(updated))
}
