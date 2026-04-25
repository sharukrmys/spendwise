import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay } from 'date-fns'
import { expenseQueries } from '@/db/queries'
import type { RecurrenceInterval } from '@/core/types'

function nextOccurrence(from: number, interval: RecurrenceInterval): number {
  const d = new Date(from)
  switch (interval) {
    case 'daily':   return addDays(d, 1).getTime()
    case 'weekly':  return addWeeks(d, 1).getTime()
    case 'monthly': return addMonths(d, 1).getTime()
    case 'yearly':  return addYears(d, 1).getTime()
  }
}

/**
 * Runs on app load. For each recurring expense whose nextDate is in the past,
 * creates a new expense instance and advances nextDate. Capped at 12 instances
 * per expense to avoid runaway creation on long offline gaps.
 */
export async function processRecurringExpenses(): Promise<number> {
  const recurring = await expenseQueries.getRecurring()
  const today = startOfDay(new Date()).getTime()
  let created = 0

  for (const template of recurring) {
    if (!template.recurrence) continue
    const { interval, nextDate, endDate } = template.recurrence
    let next = nextDate ?? nextOccurrence(template.date, interval)

    let iterations = 0
    while (isBefore(next, today) && iterations < 12) {
      if (endDate && next > endDate) break

      // Create a new expense instance for this occurrence
      await expenseQueries.add({
        type: template.type,
        amount: template.amount,
        currency: template.currency,
        categoryId: template.categoryId,
        subcategoryId: template.subcategoryId,
        tags: template.tags,
        notes: template.notes,
        date: next,
        paymentMethod: template.paymentMethod,
        isRecurring: false,          // instances are not templates themselves
        attachments: template.attachments,
        location: template.location,
      })

      next = nextOccurrence(next, interval)
      created++
      iterations++
    }

    // Update the template's nextDate so we don't re-process
    if (iterations > 0) {
      await expenseQueries.update(template.id, {
        recurrence: { ...template.recurrence, nextDate: next },
      })
    }
  }

  return created
}
