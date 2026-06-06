import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { useExpenseStore } from '@/store/useExpenseStore'
import { parseSMS, merchantToNotes } from '@/core/smsParser'

/**
 * Handles incoming shares from the PWA share_target.
 * Uses parseSMS for robust extraction of amount, merchant, and notes.
 */
export function ShareTargetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { load } = useExpenseStore()
  const [open, setOpen] = useState(true)

  const raw = params.get('text') ?? params.get('title') ?? ''
  const parsed = parseSMS(raw)
  const sharedAmount = parsed.amount
  const sharedNotes = parsed.merchant
    ? merchantToNotes(parsed.merchant)
    : (raw.replace(/[\d,]+\.?\d*/g, '').trim() || undefined)

  useEffect(() => {
    if (!open) navigate('/', { replace: true })
  }, [open, navigate])

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Add Expense">
      <ExpenseForm
        onClose={() => { setOpen(false); load() }}
        prefill={{ amount: sharedAmount, notes: sharedNotes }}
      />
    </Modal>
  )
}
