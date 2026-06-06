import type { Category, Currency, AppSettings } from "./types";

export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "AU$", name: "Australian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
];

export const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  {
    name: "Food & Dining",
    icon: "🍽️",
    color: "#f59e0b",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Groceries",
    icon: "🛒",
    color: "#22c55e",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Transport",
    icon: "🚗",
    color: "#3b82f6",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Shopping",
    icon: "🛍️",
    color: "#ec4899",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Entertainment",
    icon: "🎬",
    color: "#8b5cf6",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Health",
    icon: "💊",
    color: "#ef4444",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Housing",
    icon: "🏠",
    color: "#06b6d4",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Utilities",
    icon: "⚡",
    color: "#f97316",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Education",
    icon: "📚",
    color: "#84cc16",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Travel",
    icon: "✈️",
    color: "#6366f1",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Subscriptions",
    icon: "📱",
    color: "#14b8a6",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Personal Care",
    icon: "💆",
    color: "#f43f5e",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Gifts",
    icon: "🎁",
    color: "#a855f7",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Investments",
    icon: "📈",
    color: "#10b981",
    parentId: undefined,
    isDefault: true,
  },
  {
    name: "Other",
    icon: "📦",
    color: "#6b7280",
    parentId: undefined,
    isDefault: true,
  },
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  crypto: "Crypto",
  other: "Other",
};

export const PAYMENT_METHOD_ICONS: Record<string, string> = {
  cash: "💵",
  card: "💳",
  upi: "📲",
  bank_transfer: "🏦",
  crypto: "🪙",
  other: "💱",
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accentColor: "#7c5cfc",
  defaultCurrency: "INR",
  defaultPaymentMethod: "upi",
  firstDayOfWeek: 1,
  showCents: true,
  enableBiometrics: false,
  enableEncryption: false,
  compactMode: false,
  notifications: false,
  onboardingDone: false,
  includeGroupSpends: false,
  myGroupName: "",
  enableBudgets: true,
  tripMode: false,
  tripCurrency: "USD",
  tripName: "",
};

export const THEME_PRESETS = [
  { value: "dark", label: "Dark", icon: "🌑" },
  { value: "light", label: "Light", icon: "☀️" },
  { value: "system", label: "System", icon: "📱" },
  { value: "amoled", label: "AMOLED", icon: "⬛" },
  { value: "midnight", label: "Midnight Blue", icon: "🌊" },
  { value: "forest", label: "Forest", icon: "🌿" },
  { value: "rose", label: "Rose Gold", icon: "🌹" },
] as const;

export const ACCENT_COLORS = [
  { label: "Violet", value: "#7c5cfc" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Green", value: "#22c55e" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Orange", value: "#f97316" },
  { label: "Pink", value: "#ec4899" },
  { label: "Gold", value: "#f59e0b" },
];

export const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#ef4444",
  "#f97316",
  "#84cc16",
  "#14b8a6",
  "#3b82f6",
  "#a855f7",
  "#f43f5e",
  "#10b981",
  "#6b7280",
];
