import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { useExpenseStore } from '@/store/useExpenseStore'

/**
 * Handles incoming shares from the PWA share_target.
 * Parses amount from shared text/title and pre-fills the expense form.
 */
export function ShareTargetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { load } = useExpenseStore()
  const [open, setOpen] = useState(true)

  // Extract a numeric amount from shared text (e.g. "₹250" or "250.00")
  const raw = params.get('text') ?? params.get('title') ?? ''
  const match = raw.match(/[\d,]+\.?\d*/)
  const sharedAmount = match ? parseFloat(match[0].replace(/,/g, '')) : undefined
  const sharedNotes = raw.replace(/[\d,]+\.?\d*/, '').trim() || undefined

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
