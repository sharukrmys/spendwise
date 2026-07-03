import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  subMonths,
  subDays,
  startOfYear,
  endOfYear,
} from "date-fns";
import type {
  Expense,
  ExpenseSummary,
  Group,
  GroupExpense,
  TrendPoint,
} from "./types";
import { CURRENCIES } from "./constants";

// ─── ID Generation ──────────────────────────────────────────────────
export const generateId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

// ─── Currency Formatting ────────────────────────────────────────────
export const formatCurrency = (
  amount: number,
  currencyCode = "USD",
  showCents = true,
): string => {
  const currency = CURRENCIES.find((c) => c.code === currencyCode);
  const symbol = currency?.symbol ?? currencyCode;
  const formatted = showCents
    ? Math.abs(amount).toFixed(2)
    : Math.abs(amount).toFixed(0);

  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
};

export const formatCompact = (amount: number, currencyCode = "USD"): string => {
  const currency = CURRENCIES.find((c) => c.code === currencyCode);
  const symbol = currency?.symbol ?? currencyCode;
  if (amount >= 1_000_000)
    return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  return `${symbol}${amount.toFixed(0)}`;
};

// ─── Date Helpers ───────────────────────────────────────────────────
export const toDateStr = (ts: number): string =>
  format(new Date(ts), "yyyy-MM-dd");
export const formatDate = (ts: number, fmt = "MMM d, yyyy"): string =>
  format(new Date(ts), fmt);
export const today = (): number => Date.now();

// Shows just the time for today's transactions, otherwise prefixes the date
// (and the year too, if not the current year) so older entries in a list
// remain distinguishable by day.
export const formatRelativeDateTime = (ts: number): string => {
  const d = new Date(ts);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const time = format(d, "h:mm a");

  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday · ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${format(d, sameYear ? "MMM d" : "MMM d, yyyy")} · ${time}`;
};

export const getMonthRange = (date: Date = new Date()) => ({
  start: startOfMonth(date).getTime(),
  end: endOfMonth(date).getTime(),
});

export const getWeekRange = (date: Date = new Date(), firstDay = 1) => ({
  start: startOfWeek(date, { weekStartsOn: firstDay as 0 | 1 }).getTime(),
  end: endOfWeek(date, { weekStartsOn: firstDay as 0 | 1 }).getTime(),
});

export const getYearRange = (date: Date = new Date()) => ({
  start: startOfYear(date).getTime(),
  end: endOfYear(date).getTime(),
});

export const getDaysInMonth = (date: Date): Date[] =>
  eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });

// ─── Expense Analytics ──────────────────────────────────────────────
export const summarizeExpenses = (expenses: Expense[]): ExpenseSummary => {
  const summary: ExpenseSummary = {
    total: 0,
    count: expenses.length,
    byCategory: {},
    byDay: {},
    byPaymentMethod: {},
  };

  for (const e of expenses) {
    const isExpense = e.type !== "income";
    if (isExpense) {
      summary.total += e.amount;
      summary.byCategory[e.categoryId] =
        (summary.byCategory[e.categoryId] ?? 0) + e.amount;
      const day = toDateStr(e.date);
      summary.byDay[day] = (summary.byDay[day] ?? 0) + e.amount;
      summary.byPaymentMethod[e.paymentMethod] =
        (summary.byPaymentMethod[e.paymentMethod] ?? 0) + e.amount;
    }
  }

  return summary;
};

export const buildTrendData = (
  expenses: Expense[],
  months = 6,
): TrendPoint[] => {
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const { start, end } = getMonthRange(d);
    const total = expenses
      .filter((e) => e.date >= start && e.date <= end)
      .reduce((s, e) => s + e.amount, 0);
    points.push({
      date: format(d, "MMM"),
      amount: parseFloat(total.toFixed(2)),
    });
  }
  return points;
};

export const buildDailyHeatmap = (
  expenses: Expense[],
  date: Date,
): Record<string, number> => {
  const days = getDaysInMonth(date);
  const map: Record<string, number> = {};
  for (const day of days) map[format(day, "yyyy-MM-dd")] = 0;
  for (const e of expenses) {
    const key = toDateStr(e.date);
    if (key in map) map[key] = (map[key] ?? 0) + e.amount;
  }
  return map;
};

/**
 * Current consecutive-day logging streak, based on when entries were
 * actually created (not the transaction date the user picked) so it
 * reflects real app usage rather than backdated entries. A day with no
 * activity yet doesn't break the streak until it's actually over — so
 * logging first thing tomorrow still continues today's streak.
 */
export const computeLoggingStreak = (expenses: Expense[]): number => {
  if (expenses.length === 0) return 0;
  const activeDays = new Set(expenses.map((e) => toDateStr(e.createdAt)));
  let cursor = new Date();
  if (!activeDays.has(toDateStr(cursor.getTime()))) {
    cursor = subDays(cursor, 1);
  }
  let streak = 0;
  while (activeDays.has(toDateStr(cursor.getTime()))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
};

// ─── Class Names ────────────────────────────────────────────────────
export const cn = (...classes: (string | undefined | null | false)[]): string =>
  classes.filter(Boolean).join(" ");

// ─── Misc ───────────────────────────────────────────────────────────
export const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T => {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
};

export const groupBy = <T>(
  arr: T[],
  key: (item: T) => string,
): Record<string, T[]> =>
  arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );

export const avatarColor = (name: string): string => {
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#22c55e",
    "#06b6d4",
    "#ef4444",
    "#3b82f6",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── Group Expenses → Expense[] ─────────────────────────────────────
// Converts group expenses where `myName` is the payer into synthetic
// personal Expense records so they can be included in lists/totals/reports.
export function groupExpensesToExpenses(
  groups: Group[],
  groupExpensesMap: Record<string, GroupExpense[]>,
  myName: string,
): Expense[] {
  if (!myName.trim()) return [];
  const normalizedName = myName.trim().toLowerCase();
  const result: Expense[] = [];

  for (const group of groups) {
    const myMember = group.members.find(
      (m) => m.name.trim().toLowerCase() === normalizedName,
    );
    if (!myMember) continue;
    const expenses = groupExpensesMap[group.id] ?? [];
    for (const ge of expenses) {
      // Skip settlements and voided records
      if (ge.notes === "__settlement__" || ge.invalidated) continue;
      if (ge.paidBy !== myMember.id) continue;
      result.push({
        id: `grp-${ge.id}`,
        type: "expense",
        amount: ge.amount,
        currency: ge.currency,
        categoryId: ge.categoryId ?? "",
        tags: [],
        notes: `[${group.name}] ${ge.description}`,
        date: ge.date,
        paymentMethod: "other",
        isRecurring: false,
        groupId: group.id,
        createdAt: ge.createdAt,
        updatedAt: ge.updatedAt ?? ge.createdAt,
      });
    }
  }
  return result;
}
