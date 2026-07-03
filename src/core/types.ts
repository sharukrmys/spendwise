// ─── Core Domain Types ─────────────────────────────────────────────
// Shared between web and future React Native layers.
// No browser-specific imports here.

export type Currency = {
  code: string; // "USD"
  symbol: string; // "$"
  name: string; // "US Dollar"
};

export type PaymentMethod =
  | "cash"
  | "card"
  | "upi"
  | "bank_transfer"
  | "crypto"
  | "other";

export type RecurrenceInterval = "daily" | "weekly" | "monthly" | "yearly";

export interface Category {
  id: string;
  name: string;
  icon: string; // emoji or icon name
  color: string; // hex color
  parentId?: string; // for subcategories
  isDefault: boolean;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Expense {
  id: string;
  type: "expense" | "income"; // income or expense
  amount: number;
  currency: string; // currency code, default "USD"
  categoryId: string;
  subcategoryId?: string;
  tags: string[]; // tag ids
  notes?: string;
  date: number; // unix timestamp ms
  paymentMethod: PaymentMethod;
  isRecurring: boolean;
  recurrence?: {
    interval: RecurrenceInterval;
    nextDate?: number;
    endDate?: number;
  };
  attachments?: string[]; // base64 or file refs
  location?: string;
  groupId?: string; // linked group (set when expense is also split in a group)
  linkedGroupExpenseId?: string; // ID of the GroupExpense record created alongside this expense (single source of truth link)
  createdAt: number;
  updatedAt: number;
}

export interface Budget {
  id: string;
  categoryId?: string; // undefined = overall budget
  amount: number;
  currency: string;
  period: "weekly" | "monthly" | "yearly";
  startDate: number;
  createdAt: number;
  updatedAt: number;
}

export interface GroupMember {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
}

export interface GroupExpense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string; // member id
  splits: Array<{
    memberId: string;
    amount: number;
    settled: boolean;
    settledAt?: number; // unix ms when marked settled
    settledBy?: string; // member id who confirmed settlement
  }>;
  date: number;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  tags?: string[];
  attachments?: string[];
  notes?: string;
  invalidated?: boolean; // true = voided settlement (read-only, cannot re-enable)
  createdAt: number;
  updatedAt?: number; // last edit timestamp
  updatedBy?: string; // member id who last edited
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  members: GroupMember[];
  currency: string;
  createdAt: number;
  updatedAt: number;
  /** Drive file ID used as the share/invite code for multi-user sync */
  shareCode?: string;
  /** True when this device created the shared Drive file */
  isOwner?: boolean;
  /** Soft-archived groups are hidden from main list but preserved */
  archived?: boolean;
  /** Member id that represents "me" on this device. Local-only — never overwritten by a remote sync merge. */
  myMemberId?: string;
}

export type ThemePreset =
  | "dark"
  | "light"
  | "system"
  | "amoled"
  | "midnight"
  | "forest"
  | "rose";

export interface AppSettings {
  theme: ThemePreset;
  accentColor: string; // hex, default '#7c5cfc'
  defaultCurrency: string;
  defaultPaymentMethod: PaymentMethod;
  firstDayOfWeek: 0 | 1; // 0=Sunday, 1=Monday
  showCents: boolean;
  enableBiometrics: boolean;
  enableEncryption: boolean;
  compactMode: boolean;
  notifications: boolean;
  onboardingDone: boolean;
  includeGroupSpends: boolean; // show group expenses I paid in personal lists/totals
  myGroupName: string; // my name as it appears in group member lists
  enableBudgets: boolean; // show budget tracking features (bar, ring, alerts)
  // Trip mode
  tripMode: boolean;
  tripCurrency: string;
  tripName: string;
  tripStartDate?: number;
  tripEndDate?: number;
  // Highest logging-streak milestone already celebrated, so the confetti
  // burst on the dashboard only fires once per milestone, not every render.
  lastCelebratedStreak: number;
}

// ─── Analytics / Derived Types ─────────────────────────────────────

export interface ExpenseSummary {
  total: number;
  count: number;
  byCategory: Record<string, number>;
  byDay: Record<string, number>; // "YYYY-MM-DD" → amount
  byPaymentMethod: Record<string, number>;
}

export interface TrendPoint {
  date: string;
  amount: number;
}

// ─── Tasks / SpendPlan ──────────────────────────────────────────────

export type TaskType = "todo" | "checklist";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "done";

export interface ChecklistItem {
  id: string;
  name: string;
  quantity?: number;
  estimatedPrice?: number;
  unit?: string;
  checked: boolean;
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: number; // unix ms
  dueTime?: string; // 'HH:mm'
  location?: string;
  amount?: number; // estimated budget / total
  currency?: string;
  categoryId?: string;
  tags?: string[];
  items?: ChecklistItem[]; // checklist only
  convertedExpenseId?: string;
  isRecurring?: boolean;
  recurrence?: {
    interval: RecurrenceInterval;
    nextDate?: number;
    endDate?: number;
  };
  createdAt: number;
  updatedAt: number;
}
