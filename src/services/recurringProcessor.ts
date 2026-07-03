import { addDays, addWeeks, addMonths, addYears, isBefore, startOfDay } from 'date-fns'
import { expenseQueries } from '@/db/queries'
import type { Expense, RecurrenceInterval } from '@/core/types'

export function nextOccurrence(from: number, interval: RecurrenceInterval): number {
  const d = new Date(from)
  switch (interval) {
    case 'daily':   return addDays(d, 1).getTime()
    case 'weekly':  return addWeeks(d, 1).getTime()
    case 'monthly': return addMonths(d, 1).getTime()
    case 'yearly':  return addYears(d, 1).getTime()
  }
}

/**
 * Recurring expenses only get a stored nextDate once the background
 * processor has run a full cycle. Until then (e.g. right after creation, or
 * on data imported from before this feature existed), fall back to deriving
 * it from the template's date + interval so every recurring expense is
 * still scheduled consistently wherever it's displayed.
 */
export function effectiveNextDate(e: Expense): number {
  return e.recurrence?.nextDate ?? nextOccurrence(e.date, e.recurrence?.interval ?? 'monthly')
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

/**
 * Manually settles one cycle of a subscription: records a real transaction
 * dated to when you actually paid (which may be a few days before or after
 * the scheduled due date), then advances nextDate from the *originally
 * scheduled* date — not from today — so paying early/late never drifts the
 * billing cadence.
 */
export interface MarkPaidResult {
  created: Expense
  templateId: string
  previousRecurrence: Expense['recurrence']
  previousAmount: number
}

export interface MarkPaidOverrides {
  /** Amount actually paid this cycle. Also becomes the template's amount, so future cycles reflect a price change. */
  amount?: number
  /** When the payment happened. Defaults to now. */
  paidDate?: number
  /** The upcoming cycle's due date. Defaults to one interval past the originally scheduled date. */
  nextDate?: number
}

export async function markSubscriptionPaid(template: Expense, overrides?: MarkPaidOverrides): Promise<MarkPaidResult> {
  if (!template.recurrence) throw new Error('Not a recurring expense')
  const { interval } = template.recurrence
  const scheduledDate = template.recurrence.nextDate ?? template.date
  const paidAmount = overrides?.amount ?? template.amount
  const paidDate = overrides?.paidDate ?? Date.now()
  const nextDate = overrides?.nextDate ?? nextOccurrence(scheduledDate, interval)
  const previousRecurrence = template.recurrence
  const previousAmount = template.amount

  const created = await expenseQueries.add({
    type: template.type,
    amount: paidAmount,
    currency: template.currency,
    categoryId: template.categoryId,
    subcategoryId: template.subcategoryId,
    tags: template.tags,
    notes: template.notes,
    date: paidDate,
    paymentMethod: template.paymentMethod,
    isRecurring: false,
    attachments: template.attachments,
    location: template.location,
  })

  await expenseQueries.update(template.id, {
    amount: paidAmount,
    recurrence: { ...template.recurrence, nextDate },
  })

  return { created, templateId: template.id, previousRecurrence, previousAmount }
}

/** Reverses markSubscriptionPaid: deletes the recorded transaction and restores the template's prior amount + nextDate. */
export async function undoMarkSubscriptionPaid(result: MarkPaidResult): Promise<void> {
  await expenseQueries.delete(result.created.id)
  await expenseQueries.update(result.templateId, { recurrence: result.previousRecurrence, amount: result.previousAmount })
}
