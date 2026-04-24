import Dexie, { type Table } from "dexie";
import type {
  Expense,
  Category,
  Tag,
  Budget,
  Group,
  GroupExpense,
  AppSettings,
} from "@/core/types";
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "@/core/constants";
import { generateId } from "@/core/utils";

// ─── Settings Record ────────────────────────────────────────────────
export interface SettingsRecord {
  key: string;
  value: unknown;
}

// ─── Database Class ─────────────────────────────────────────────────
export class ExpenseDB extends Dexie {
  expenses!: Table<Expense>;
  categories!: Table<Category>;
  tags!: Table<Tag>;
  budgets!: Table<Budget>;
  groups!: Table<Group>;
  groupExpenses!: Table<GroupExpense>;
  settings!: Table<SettingsRecord>;

  constructor() {
    super("ExpenseManager");

    // v1 schema
    this.version(1).stores({
      expenses:
        "++id, date, categoryId, amount, paymentMethod, isRecurring, createdAt",
      categories: "++id, name, parentId, isDefault",
      tags: "++id, name",
      budgets: "++id, categoryId, period",
      groups: "++id, name, createdAt",
      groupExpenses: "++id, groupId, date, paidBy",
      settings: "key",
    });
  }
}

export const db = new ExpenseDB();

// ─── Seed Default Data ──────────────────────────────────────────────
let seeded = false;
export async function seedDefaults(): Promise<void> {
  if (seeded) return;
  seeded = true;

  // Deduplicate categories by name (cleans up any prior double-inserts)
  const allCats = await db.categories.toArray();
  const seen = new Map<string, string>();
  const dupeIds: string[] = [];
  for (const c of allCats) {
    if (seen.has(c.name)) {
      dupeIds.push(c.id);
    } else {
      seen.set(c.name, c.id);
    }
  }
  if (dupeIds.length > 0) {
    await db.categories.bulkDelete(dupeIds);
  }

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    const now = Date.now();
    const cats = DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      id: generateId(),
      createdAt: now,
    }));
    await db.categories.bulkAdd(cats);
  }

  const settingsExist = await db.settings.get("app");
  if (!settingsExist) {
    await db.settings.put({ key: "app", value: DEFAULT_SETTINGS });
  }
}

// ─── Settings helpers ───────────────────────────────────────────────
export async function getSettings(): Promise<AppSettings> {
  const record = await db.settings.get("app");
  return (record?.value as AppSettings) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: "app", value: settings });
}
