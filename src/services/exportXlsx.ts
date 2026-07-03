/**
 * Excel export service — SheetJS (xlsx 0.18.x)
 * Produces multi-sheet workbooks with proper column widths, number formats,
 * merged-cell headers, and data structured for one-click charting in Excel /
 * Google Sheets.
 */
import * as XLSX from 'xlsx'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import type { Expense, Category, Group, GroupExpense } from '@/core/types'
import { PAYMENT_METHOD_LABELS } from '@/core/constants'

// ─── Helpers ────────────────────────────────────────────────────────────────

function colWidths(widths: number[]) {
  return widths.map(w => ({ wch: w }))
}



function triggerDownload(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

// ─── Personal Monthly Export ──────────────────────────────────────────────────

export async function exportPersonalMonthly(
  allExpenses: Expense[],
  categories: Category[],
  _currency: string,
  _showCents: boolean,
) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Month-wise Summary ──────────────────────────────────────
  const months = eachMonthOfInterval({
    start: subMonths(new Date(), 11),
    end: new Date(),
  })

  const monthRows: unknown[][] = [[
    'Month', 'Income', 'Expenses', 'Net Balance', 'Savings Rate %',
    'Transactions', 'Avg/Day', 'Top Category', 'Top Category Amount',
  ]]

  for (const month of months) {
    const start = startOfMonth(month).getTime()
    const end = endOfMonth(month).getTime()
    const exps = allExpenses.filter(e => e.date >= start && e.date <= end)
    const income = exps.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
    const spent = exps.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
    const balance = income - spent
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const savingsRate = income > 0 ? parseFloat(((balance / income) * 100).toFixed(1)) : 0

    const byCategory: Record<string, number> = {}
    exps.filter(e => e.type !== 'income').forEach(e => {
      byCategory[e.categoryId] = (byCategory[e.categoryId] ?? 0) + e.amount
    })
    const topCatEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    const topCat = topCatEntry ? categories.find(c => c.id === topCatEntry[0])?.name ?? 'Other' : '—'
    const topCatAmt = topCatEntry ? topCatEntry[1] : 0

    monthRows.push([
      format(month, 'MMMM yyyy'),
      income, spent, balance, savingsRate,
      exps.filter(e => e.type !== 'income').length,
      parseFloat((spent / days).toFixed(2)),
      topCat, topCatAmt,
    ])
  }

  const wsMonths = XLSX.utils.aoa_to_sheet(monthRows)
  wsMonths['!cols'] = colWidths([18, 14, 14, 14, 14, 14, 12, 20, 18])
  XLSX.utils.book_append_sheet(wb, wsMonths, 'Monthly Summary')

  // ── Sheet 2: All Transactions ────────────────────────────────────────
  const sorted = [...allExpenses].sort((a, b) => b.date - a.date)
  const txRows: unknown[][] = [[
    'Date', 'Time', 'Type', 'Category', 'Description / Notes',
    'Amount', 'Payment Method', 'Tags', 'Recurring', 'Month',
  ]]

  let runningBalance = 0
  // Calculate starting balance going forward
  const allSorted = [...sorted].reverse()
  allSorted.forEach(e => {
    runningBalance += e.type === 'income' ? e.amount : -e.amount
  })
  // Now iterate newest-first from total
  let bal = allSorted.reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0)
  for (const e of sorted) {
    const cat = categories.find(c => c.id === e.categoryId)
    txRows.push([
      format(new Date(e.date), 'dd MMM yyyy'),
      format(new Date(e.date), 'HH:mm'),
      e.type === 'income' ? 'Income' : 'Expense',
      cat?.name ?? 'Uncategorized',
      e.notes ?? '',
      e.type === 'income' ? e.amount : -e.amount,
      PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod,
      e.tags?.length ? e.tags.join(', ') : '',
      e.isRecurring ? 'Yes' : 'No',
      format(new Date(e.date), 'MMMM yyyy'),
    ])
    bal -= e.type === 'income' ? e.amount : -e.amount
  }

  const wsTx = XLSX.utils.aoa_to_sheet(txRows)
  wsTx['!cols'] = colWidths([14, 8, 10, 18, 32, 14, 18, 20, 10, 16])
  XLSX.utils.book_append_sheet(wb, wsTx, 'All Transactions')

  // ── Sheet 3: By Category ─────────────────────────────────────────────
  const catMap: Record<string, { amount: number; count: number; income: number }> = {}
  allExpenses.forEach(e => {
    if (!catMap[e.categoryId]) catMap[e.categoryId] = { amount: 0, count: 0, income: 0 }
    if (e.type === 'income') catMap[e.categoryId].income += e.amount
    else { catMap[e.categoryId].amount += e.amount; catMap[e.categoryId].count++ }
  })
  const totalExpenses = Object.values(catMap).reduce((s, v) => s + v.amount, 0)

  const catRows: unknown[][] = [[
    'Category', 'Total Spent', 'No. of Transactions', '% of Total', 'Avg per Transaction',
  ]]
  Object.entries(catMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .forEach(([catId, { amount, count }]) => {
      const cat = categories.find(c => c.id === catId)
      catRows.push([
        cat?.name ?? 'Uncategorized',
        amount,
        count,
        totalExpenses > 0 ? parseFloat(((amount / totalExpenses) * 100).toFixed(1)) : 0,
        count > 0 ? parseFloat((amount / count).toFixed(2)) : 0,
      ])
    })
  catRows.push(['', '', '', '', ''])
  catRows.push(['TOTAL', totalExpenses, allExpenses.filter(e => e.type !== 'income').length, 100, ''])

  const wsCat = XLSX.utils.aoa_to_sheet(catRows)
  wsCat['!cols'] = colWidths([22, 16, 20, 14, 20])
  XLSX.utils.book_append_sheet(wb, wsCat, 'By Category')

  // ── Sheet 4: By Payment Method ───────────────────────────────────────
  const pmMap: Record<string, { amount: number; count: number }> = {}
  allExpenses.filter(e => e.type !== 'income').forEach(e => {
    if (!pmMap[e.paymentMethod]) pmMap[e.paymentMethod] = { amount: 0, count: 0 }
    pmMap[e.paymentMethod].amount += e.amount
    pmMap[e.paymentMethod].count++
  })

  const pmRows: unknown[][] = [['Payment Method', 'Total Spent', 'Transactions', '% of Total']]
  Object.entries(pmMap).sort((a, b) => b[1].amount - a[1].amount).forEach(([method, { amount, count }]) => {
    pmRows.push([
      PAYMENT_METHOD_LABELS[method] ?? method,
      amount, count,
      totalExpenses > 0 ? parseFloat(((amount / totalExpenses) * 100).toFixed(1)) : 0,
    ])
  })

  const wsPm = XLSX.utils.aoa_to_sheet(pmRows)
  wsPm['!cols'] = colWidths([22, 16, 16, 14])
  XLSX.utils.book_append_sheet(wb, wsPm, 'Payment Methods')

  // ── Sheet 5: Daily Trend (chart-ready) ──────────────────────────────
  // Last 90 days, one row per day
  const dailyRows: unknown[][] = [['Date', 'Day', 'Expenses', 'Income', 'Net', 'Cumulative Expenses']]
  let cumulative = 0
  const last90 = Array.from({ length: 90 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (89 - i))
    return d
  })
  for (const day of last90) {
    const start = new Date(day).setHours(0, 0, 0, 0)
    const end = new Date(day).setHours(23, 59, 59, 999)
    const dayExps = allExpenses.filter(e => e.date >= start && e.date <= end)
    const spent = dayExps.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
    const income = dayExps.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
    cumulative += spent
    dailyRows.push([
      format(day, 'dd MMM yyyy'),
      format(day, 'EEE'),
      spent, income, income - spent,
      parseFloat(cumulative.toFixed(2)),
    ])
  }

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows)
  wsDaily['!cols'] = colWidths([16, 8, 14, 14, 14, 20])
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Trend')

  // ── Sheet 6: Insights ─────────────────────────────────────────────────
  const thisMonth = allExpenses.filter(e => {
    const s = startOfMonth(new Date()).getTime()
    const en = endOfMonth(new Date()).getTime()
    return e.date >= s && e.date <= en
  })
  const thisIncome = thisMonth.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const thisSpent = thisMonth.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
  const highestDay = (() => {
    const byDay: Record<string, number> = {}
    allExpenses.filter(e => e.type !== 'income').forEach(e => {
      const k = format(new Date(e.date), 'EEE')
      byDay[k] = (byDay[k] ?? 0) + e.amount
    })
    return Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]
  })()

  const insightRows: unknown[][] = [
    ['Financial Insights', ''],
    ['', ''],
    ['This Month', ''],
    ['Income', thisIncome],
    ['Expenses', thisSpent],
    ['Net Balance', thisIncome - thisSpent],
    ['Savings Rate', thisIncome > 0 ? `${((( thisIncome - thisSpent) / thisIncome) * 100).toFixed(1)}%` : 'N/A'],
    ['', ''],
    ['All Time', ''],
    ['Total Transactions', allExpenses.length],
    ['Total Spent', allExpenses.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0)],
    ['Total Income', allExpenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)],
    ['Unique Categories Used', Object.keys(catMap).length],
    ['Highest Spending Day', highestDay ? highestDay[0] : 'N/A'],
    ['Avg Transaction Size', allExpenses.length > 0
      ? parseFloat((allExpenses.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0) / Math.max(1, allExpenses.filter(e => e.type !== 'income').length)).toFixed(2))
      : 0],
  ]

  const wsInsights = XLSX.utils.aoa_to_sheet(insightRows)
  wsInsights['!cols'] = colWidths([28, 20])
  if (!wsInsights['!merges']) wsInsights['!merges'] = []
  wsInsights['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } })
  XLSX.utils.book_append_sheet(wb, wsInsights, 'Insights')

  triggerDownload(wb, `expenses_${format(new Date(), 'yyyy-MM')}.xlsx`)
}

// ─── Group Export ─────────────────────────────────────────────────────────────

export function exportGroupData(
  group: Group,
  expenses: GroupExpense[],
  categories: Category[],
) {
  const wb = XLSX.utils.book_new()
  const sorted = [...expenses].sort((a, b) => b.date - a.date)
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  // ── Sheet 1: Executive Summary ────────────────────────────────────────
  const allSplits = expenses.flatMap(e => e.splits)
  const settledAmt = expenses.flatMap(e =>
    e.splits.filter(s => s.settled).map(s => s.amount)
  ).reduce((s, v) => s + v, 0)
  const unsettledAmt = expenses.flatMap(e =>
    e.splits.filter(s => !s.settled).map(s => s.amount)
  ).reduce((s, v) => s + v, 0)

  const summaryRows: unknown[][] = [
    ['GROUP FINANCIAL REPORT', ''],
    ['', ''],
    ['Group Name', group.name],
    ['Currency', group.currency],
    ['Members', group.members.map(m => m.name).join(', ')],
    ['Total Members', group.members.length],
    ['Report Generated', format(new Date(), 'dd MMM yyyy, HH:mm')],
    ['', ''],
    ['FINANCIAL SUMMARY', ''],
    ['Total Group Spend', totalSpent],
    ['Total Expenses', expenses.length],
    ['Average per Expense', expenses.length > 0 ? parseFloat((totalSpent / expenses.length).toFixed(2)) : 0],
    ['', ''],
    ['SETTLEMENT STATUS', ''],
    ['Settled Amount', settledAmt],
    ['Unsettled Amount', unsettledAmt],
    ['Settlement Rate %', allSplits.length > 0
      ? parseFloat(((allSplits.filter(s => s.settled).length / allSplits.length) * 100).toFixed(1))
      : 0],
    ['Pending Settlements', allSplits.filter(s => !s.settled).length],
  ]

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = colWidths([28, 40])
  if (!wsSummary['!merges']) wsSummary['!merges'] = []
  wsSummary['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } })
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // ── Sheet 2: All Expenses (detailed) ─────────────────────────────────
  // Header row — description columns + one column per member split
  const memberNames = group.members.map(m => m.name)
  const expHeader = [
    'Date', 'Time', 'Description', 'Category', 'Total Amount', 'Paid By', 'Notes',
    ...memberNames.map(n => `${n} Share`),
    ...memberNames.map(n => `${n} Settled`),
    ...memberNames.map(n => `${n} Settled On`),
  ]
  const expRows: unknown[][] = [expHeader]

  for (const e of sorted) {
    const cat = categories.find(c => c.id === e.categoryId)
    const payer = group.members.find(m => m.id === e.paidBy)
    const memberShares = group.members.map(m => {
      const split = e.splits.find(s => s.memberId === m.id)
      return split?.amount ?? 0
    })
    const memberSettled = group.members.map(m => {
      const split = e.splits.find(s => s.memberId === m.id)
      return split?.settled ? 'Yes' : split ? 'No' : '—'
    })
    const memberSettledOn = group.members.map(m => {
      const split = e.splits.find(s => s.memberId === m.id)
      return split?.settledAt ? format(new Date(split.settledAt), 'dd MMM yyyy HH:mm') : '—'
    })

    expRows.push([
      format(new Date(e.date), 'dd MMM yyyy'),
      format(new Date(e.date), 'HH:mm'),
      e.description,
      cat?.name ?? 'Uncategorized',
      e.amount,
      payer?.name ?? 'Unknown',
      e.notes ?? '',
      ...memberShares,
      ...memberSettled,
      ...memberSettledOn,
    ])
  }

  const wsExp = XLSX.utils.aoa_to_sheet(expRows)
  wsExp['!cols'] = colWidths([
    14, 8, 28, 18, 14, 14, 24,
    ...group.members.map(() => 14),
    ...group.members.map(() => 10),
    ...group.members.map(() => 18),
  ])
  XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses Detail')

  // ── Sheet 3: Per Member Report ────────────────────────────────────────
  const memberRows: unknown[][] = [[
    'Member', 'Total Paid', 'Total Share', 'Net Balance',
    'Settled', 'Outstanding', 'Settlement %', 'Expenses Paid', 'Splits Involved',
  ]]

  for (const member of group.members) {
    const paid = expenses.filter(e => e.paidBy === member.id).reduce((s, e) => s + e.amount, 0)
    const splits = expenses.flatMap(e => e.splits).filter(s => s.memberId === member.id)
    const share = splits.reduce((s, sp) => s + sp.amount, 0)
    const settled = splits.filter(s => s.settled).reduce((s, sp) => s + sp.amount, 0)
    const outstanding = splits.filter(s => !s.settled).reduce((s, sp) => s + sp.amount, 0)
    const settlePct = splits.length > 0
      ? parseFloat(((splits.filter(s => s.settled).length / splits.length) * 100).toFixed(1))
      : 100

    memberRows.push([
      member.name,
      paid,
      share,
      parseFloat((paid - share).toFixed(2)), // positive = owed back, negative = owes
      settled,
      outstanding,
      settlePct,
      expenses.filter(e => e.paidBy === member.id).length,
      splits.length,
    ])
  }

  const wsMember = XLSX.utils.aoa_to_sheet(memberRows)
  wsMember['!cols'] = colWidths([18, 14, 14, 14, 14, 14, 14, 16, 16])
  XLSX.utils.book_append_sheet(wb, wsMember, 'Per Member')

  // ── Sheet 4: Settlement Log ───────────────────────────────────────────
  const settleRows: unknown[][] = [[
    'Expense', 'Member', 'Amount', 'Status', 'Settled On', 'Settled By', 'Days to Settle',
  ]]

  for (const e of sorted) {
    for (const split of e.splits) {
      const member = group.members.find(m => m.id === split.memberId)
      const settledBy = group.members.find(m => m.id === split.settledBy)
      const daysToSettle = split.settledAt
        ? Math.round((split.settledAt - e.date) / (1000 * 60 * 60 * 24))
        : null

      settleRows.push([
        e.description,
        member?.name ?? '?',
        split.amount,
        split.settled ? 'Settled' : 'Pending',
        split.settledAt ? format(new Date(split.settledAt), 'dd MMM yyyy HH:mm') : '—',
        settledBy?.name ?? (split.settled ? member?.name ?? '?' : '—'),
        daysToSettle !== null ? daysToSettle : '—',
      ])
    }
  }

  const wsSettle = XLSX.utils.aoa_to_sheet(settleRows)
  wsSettle['!cols'] = colWidths([28, 16, 14, 12, 22, 16, 16])
  XLSX.utils.book_append_sheet(wb, wsSettle, 'Settlement Log')

  // ── Sheet 5: By Category ─────────────────────────────────────────────
  const groupCatMap: Record<string, { amount: number; count: number }> = {}
  expenses.forEach(e => {
    const key = e.categoryId ?? '__none__'
    if (!groupCatMap[key]) groupCatMap[key] = { amount: 0, count: 0 }
    groupCatMap[key].amount += e.amount
    groupCatMap[key].count++
  })

  const groupCatRows: unknown[][] = [[
    'Category', 'Total Spent', 'No. of Expenses', '% of Total', 'Avg per Expense',
    ...group.members.map(m => `${m.name} Share`),
  ]]

  Object.entries(groupCatMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .forEach(([catId, { amount, count }]) => {
      const cat = catId === '__none__' ? null : categories.find(c => c.id === catId)
      const catExpenses = expenses.filter(e => (e.categoryId ?? '__none__') === catId)
      const memberShares = group.members.map(m =>
        catExpenses.flatMap(e => e.splits.filter(s => s.memberId === m.id))
          .reduce((s, sp) => s + sp.amount, 0)
      )
      groupCatRows.push([
        cat?.name ?? 'Uncategorized',
        amount, count,
        totalSpent > 0 ? parseFloat(((amount / totalSpent) * 100).toFixed(1)) : 0,
        count > 0 ? parseFloat((amount / count).toFixed(2)) : 0,
        ...memberShares,
      ])
    })

  const wsGroupCat = XLSX.utils.aoa_to_sheet(groupCatRows)
  wsGroupCat['!cols'] = colWidths([22, 14, 16, 12, 16, ...group.members.map(() => 14)])
  XLSX.utils.book_append_sheet(wb, wsGroupCat, 'By Category')

  // ── Sheet 6: Who Owes Whom (net matrix) ──────────────────────────────
  const oweRows: unknown[][] = [
    ['NET BALANCES — Who owes whom', ...group.members.map(m => m.name)],
  ]
  // For each pair: how much does A owe B (net of all shared expenses)
  for (const rowMember of group.members) {
    const row: unknown[] = [rowMember.name]
    for (const colMember of group.members) {
      if (rowMember.id === colMember.id) {
        row.push('—')
      } else {
        // colMember paid → rowMember owes colMember
        const owes = expenses
          .filter(e => e.paidBy === colMember.id)
          .flatMap(e => e.splits.filter(s => s.memberId === rowMember.id && !s.settled))
          .reduce((s, sp) => s + sp.amount, 0)
        row.push(parseFloat(owes.toFixed(2)))
      }
    }
    oweRows.push(row)
  }
  oweRows.push([''])
  oweRows.push([`Positive value = row member owes column member that amount (unsettled)`])

  const wsOwes = XLSX.utils.aoa_to_sheet(oweRows)
  wsOwes['!cols'] = colWidths([20, ...group.members.map(() => 16)])
  if (!wsOwes['!merges']) wsOwes['!merges'] = []
  wsOwes['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: group.members.length } })
  XLSX.utils.book_append_sheet(wb, wsOwes, 'Who Owes Whom')

  const safeName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  triggerDownload(wb, `group_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}
