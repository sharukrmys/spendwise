import { useState, useMemo } from 'react'
import { ArrowRight, CheckCircle2, Check } from 'lucide-react'
import { cn, formatCurrency } from '@/core/utils'
import { CURRENCIES } from '@/core/constants'
import type { Group, GroupExpense } from '@/core/types'

export function BalancesView({ balances, members, currency, expenses, groupId, addGroupExpense }: {
  balances: Record<string, number>
  members: Group['members']
  currency: string
  expenses: GroupExpense[]
  groupId: string
  addGroupExpense: (data: Omit<GroupExpense, 'id' | 'createdAt'>) => Promise<GroupExpense>
}) {
  const sym = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency[0]
  const [settleTarget, setSettleTarget] = useState<{ debtorId: string; creditorId: string } | null>(null)
  const [partialAmt, setPartialAmt] = useState('')
  const [settling, setSettling] = useState(false)

  const entries = members.map(m => ({ member: m, balance: balances[m.id] ?? 0 }))

  // Compute debts accounting for existing settlement payment records
  const debts = useMemo(() => {
    const debtMap: Record<string, Record<string, number>> = {}
    // Pass 1: sum unsettled splits from regular expenses
    for (const e of expenses) {
      if (e.notes === '__settlement__') continue
      for (const s of e.splits) {
        if (!s.settled && s.memberId !== e.paidBy && s.amount > 0) {
          if (!debtMap[s.memberId]) debtMap[s.memberId] = {}
          debtMap[s.memberId][e.paidBy] = (debtMap[s.memberId][e.paidBy] ?? 0) + s.amount
        }
      }
    }
    // Pass 2: subtract active (non-invalidated) settlement payments
    for (const e of expenses) {
      if (e.notes !== '__settlement__' || e.invalidated) continue
      const creditorId = e.splits[0]?.memberId
      if (creditorId && debtMap[e.paidBy]?.[creditorId] !== undefined) {
        debtMap[e.paidBy][creditorId] = Math.max(0, (debtMap[e.paidBy][creditorId] ?? 0) - e.amount)
      }
    }
    const result: { debtorId: string; creditorId: string; amount: number }[] = []
    for (const [debtorId, creditors] of Object.entries(debtMap)) {
      for (const [creditorId, amount] of Object.entries(creditors)) {
        if (amount > 0.005) result.push({ debtorId, creditorId, amount })
      }
    }
    return result.sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const debtAmount = settleTarget
    ? (debts.find(d => d.debtorId === settleTarget.debtorId && d.creditorId === settleTarget.creditorId)?.amount ?? 0)
    : 0
  const partialNum = parseFloat(partialAmt) || 0

  const recordPayment = async (debtorId: string, creditorId: string, amount: number) => {
    const debtor = members.find(m => m.id === debtorId)!
    const creditor = members.find(m => m.id === creditorId)!
    await addGroupExpense({
      groupId,
      description: `${debtor.name} paid ${creditor.name}`,
      amount,
      currency,
      paidBy: debtorId,
      splits: [{ memberId: creditorId, amount, settled: true, settledAt: Date.now(), settledBy: debtorId }],
      date: Date.now(),
      notes: '__settlement__',
    })
  }

  const handleSettleAll = async () => {
    if (!settleTarget || settling || debtAmount <= 0) return
    setSettling(true)
    await recordPayment(settleTarget.debtorId, settleTarget.creditorId, debtAmount)
    setSettling(false)
    setSettleTarget(null)
  }

  const handleSettlePartial = async () => {
    if (!settleTarget || settling || partialNum <= 0 || partialNum > debtAmount + 0.01) return
    setSettling(true)
    await recordPayment(settleTarget.debtorId, settleTarget.creditorId, partialNum)
    setSettling(false)
    setPartialAmt('')
    setSettleTarget(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Net Balances — compact */}
      <div className="card p-3">
        <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Net Balances</p>
        {entries.length === 0 ? (
          <p className="text-sm text-2 text-center py-3">No members added yet</p>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {entries.map(({ member, balance }) => (
              <div key={member.id} className="flex items-center gap-2.5 py-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: member.avatarColor }}>
                  {member.name[0].toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-1 flex-1 truncate">{member.name}</span>
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0',
                  balance > 0 ? 'text-income' : balance < 0 ? 'text-expense' : 'text-3'
                )} style={{
                  background: balance > 0 ? 'rgba(0,200,150,0.1)' : balance < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)'
                }}>
                  {balance > 0 ? 'is owed' : balance < 0 ? 'owes' : 'settled'}
                </span>
                <span className={cn('text-sm font-bold tabular-nums shrink-0', balance > 0 ? 'text-income' : balance < 0 ? 'text-expense' : 'text-3')}>
                  {balance !== 0 ? `${balance > 0 ? '+' : ''}${formatCurrency(Math.abs(balance), currency)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settle Up */}
      {debts.length === 0 ? (
        <div className="card px-4 py-5 flex items-center gap-3">
          <CheckCircle2 size={22} className="shrink-0" style={{ color: '#00c896' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#00c896' }}>All settled up</p>
            <p className="text-[11px] text-3">No outstanding balances</p>
          </div>
        </div>
      ) : (
        <div className="card p-3">
          <p className="text-[10px] font-bold text-3 uppercase tracking-wider mb-2">Settle Up</p>
          <div className="flex flex-col gap-1.5">
            {debts.map(({ debtorId, creditorId, amount }) => {
              const debtor = members.find(m => m.id === debtorId)
              const creditor = members.find(m => m.id === creditorId)
              if (!debtor || !creditor) return null
              const isOpen = settleTarget?.debtorId === debtorId && settleTarget?.creditorId === creditorId
              return (
                <div key={`${debtorId}-${creditorId}`}
                  className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-card2)', border: `1.5px solid ${isOpen ? 'rgba(124,92,252,0.4)' : 'var(--border)'}` }}>

                  {/* Debt row */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: debtor.avatarColor }}>
                      {debtor.name[0].toUpperCase()}
                    </div>
                    <ArrowRight size={11} className="text-3 shrink-0" />
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: creditor.avatarColor }}>
                      {creditor.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 ml-0.5">
                      <p className="text-[11px] font-semibold text-1 truncate">{debtor.name} → {creditor.name}</p>
                      <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: '#ef4444' }}>{sym}{amount.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => { setSettleTarget(isOpen ? null : { debtorId, creditorId }); setPartialAmt('') }}
                      className="px-2.5 py-1 rounded-lg tap text-[10px] font-bold shrink-0"
                      style={isOpen
                        ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)', border: '1px solid var(--border)' }
                        : { background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.3)' }}>
                      {isOpen ? 'Cancel' : 'Settle'}
                    </button>
                  </div>

                  {/* Settle panel */}
                  {isOpen && (
                    <div className="border-t border-ui px-3 pb-3 pt-2.5 flex flex-col gap-2">
                      <button
                        onClick={handleSettleAll}
                        disabled={settling}
                        className="w-full py-2.5 rounded-xl text-sm font-bold tap flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg,#00c896,#00a87a)', color: '#fff', opacity: settling ? 0.6 : 1 }}>
                        {settling ? 'Recording…' : <><Check size={14} /> Settle All — {sym}{debtAmount.toFixed(2)}</>}
                      </button>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1.5 rounded-xl px-3 py-2"
                          style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}>
                          <span className="text-sm font-bold shrink-0" style={{ color: 'rgba(124,92,252,0.5)' }}>{sym}</span>
                          <input
                            type="number" inputMode="decimal" placeholder="Partial amount"
                            value={partialAmt}
                            onChange={e => setPartialAmt(e.target.value)}
                            className="flex-1 bg-transparent text-sm font-bold text-1 outline-none placeholder:text-3 min-w-0"
                          />
                        </div>
                        <button
                          onClick={handleSettlePartial}
                          disabled={settling || partialNum <= 0 || partialNum > debtAmount + 0.01}
                          className="px-3 py-2 rounded-xl tap text-sm font-bold shrink-0"
                          style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--brand)', border: '1.5px solid rgba(124,92,252,0.3)', opacity: (settling || partialNum <= 0) ? 0.45 : 1 }}>
                          Record
                        </button>
                      </div>

                      {partialNum > 0 && partialNum <= debtAmount && (
                        <p className="text-[10px] text-3">
                          {sym}{partialNum.toFixed(2)} will be recorded · {sym}{Math.max(0, debtAmount - partialNum).toFixed(2)} remaining
                        </p>
                      )}
                      {partialNum > debtAmount + 0.01 && (
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--expense)' }}>Exceeds outstanding balance</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
