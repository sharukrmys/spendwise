import { useMemo } from 'react'
import { BarChart2 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/core/utils'
import type { Group, GroupExpense, Category, AppSettings } from '@/core/types'

export function GroupReports({ expenses, members, categories, currency, settings }: {
  expenses: GroupExpense[]
  members: Group['members']
  categories: Category[]
  currency: string
  settings: AppSettings
}) {
  const fmt = (v: number) => formatCurrency(v, currency, settings.showCents)
  const regularExpenses = expenses.filter(e => e.notes !== '__settlement__')
  const total = regularExpenses.reduce((s, e) => s + e.amount, 0)

  // Per-member spend
  const memberSpend = useMemo(() => members.map(m => ({
    member: m,
    paid: regularExpenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0),
    owes: regularExpenses.flatMap(e => e.splits).filter(s => s.memberId === m.id && !s.settled).reduce((s, sp) => s + sp.amount, 0),
  })), [expenses, members])

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => {
      if (e.categoryId) map[e.categoryId] = (map[e.categoryId] ?? 0) + e.amount
    })
    return Object.entries(map)
      .map(([id, amount]) => ({ cat: categories.find(c => c.id === id), amount }))
      .filter(x => x.cat)
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, categories])

  const donutData = byCategory.length > 0
    ? byCategory.map(x => ({ name: x.cat!.name, value: x.amount, color: x.cat!.color }))
    : [{ name: 'No data', value: 1, color: '#2d2650' }]

  if (expenses.length === 0) {
    return <EmptyState icon={<BarChart2 size={40} />} title="No data yet" description="Add expenses to see group reports." />
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Summary card */}
      <div className="card p-4">
        <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">Group Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(124,92,252,0.1)' }}>
            <p className="text-[10px] text-brand font-semibold uppercase tracking-wide mb-1">Total Spent</p>
            <p className="text-lg font-bold text-1">{fmt(total)}</p>
            <p className="text-[10px] text-3">{regularExpenses.length} expenses</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,107,107,0.1)' }}>
            <p className="text-[10px] text-expense font-semibold uppercase tracking-wide mb-1">Unsettled</p>
            <p className="text-lg font-bold text-1">
              {fmt(expenses.flatMap(e => e.splits).filter(s => !s.settled).reduce((s, sp) => s + sp.amount, 0))}
            </p>
            <p className="text-[10px] text-3">{expenses.flatMap(e => e.splits).filter(s => !s.settled).length} pending</p>
          </div>
        </div>
      </div>

      {/* Who paid what */}
      <div className="card p-4">
        <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">Per Member</p>
        <div className="flex flex-col gap-3">
          {memberSpend.map(({ member, paid, owes }) => {
            const pct = total > 0 ? (paid / total) * 100 : 0
            return (
              <div key={member.id}>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: member.avatarColor }}>
                    {member.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-1">{member.name}</p>
                    <p className="text-[10px] text-3">Paid {fmt(paid)}{owes > 0 ? ` · Owes ${fmt(owes)}` : ' · All settled'}</p>
                  </div>
                  <span className="text-xs font-bold" style={{ color: member.avatarColor }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: member.avatarColor }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By category */}
      {byCategory.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">By Category</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative shrink-0 w-[80px] h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={24} outerRadius={38} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {byCategory.slice(0, 4).map(({ cat, amount }) => {
                const pct = total > 0 ? (amount / total) * 100 : 0
                return (
                  <div key={cat!.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-medium text-2">{cat!.icon} {cat!.name}</span>
                      <span className="text-[11px] font-bold text-1">{fmt(amount)}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat!.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
