import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./schema";
import { backupQueries } from "./queries";
import type { Expense, Budget, Tag } from "@/core/types";

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    type: "expense",
    amount: 100,
    currency: "USD",
    categoryId: "cat-1",
    tags: [],
    date: 1000,
    paymentMethod: "cash",
    isRecurring: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: "bud-1",
    amount: 500,
    currency: "USD",
    period: "monthly",
    startDate: 1000,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return { id: "tag-1", name: "Fun", color: "#fff", ...overrides };
}

function emptyBackup(overrides: Partial<Parameters<typeof backupQueries.mergeAll>[0]> = {}) {
  return {
    version: 2,
    exportedAt: Date.now(),
    expenses: [],
    categories: [],
    tags: [],
    budgets: [],
    groups: [],
    groupExpenses: [],
    tasks: [],
    ...overrides,
  };
}

beforeEach(async () => {
  await Promise.all([
    db.expenses.clear(),
    db.categories.clear(),
    db.tags.clear(),
    db.budgets.clear(),
    db.groups.clear(),
    db.groupExpenses.clear(),
    db.tasks.clear(),
  ]);
});

describe("backupQueries.mergeAll", () => {
  it("keeps the local expense when it is newer than the incoming one", async () => {
    await db.expenses.put(makeExpense({ amount: 999, updatedAt: 2000 }));
    await backupQueries.mergeAll(
      emptyBackup({ expenses: [makeExpense({ amount: 100, updatedAt: 1000 })] }),
    );
    const stored = await db.expenses.get("exp-1");
    expect(stored?.amount).toBe(999);
  });

  it("takes the incoming expense when it is newer than local", async () => {
    await db.expenses.put(makeExpense({ amount: 100, updatedAt: 1000 }));
    await backupQueries.mergeAll(
      emptyBackup({ expenses: [makeExpense({ amount: 999, updatedAt: 2000 })] }),
    );
    const stored = await db.expenses.get("exp-1");
    expect(stored?.amount).toBe(999);
  });

  it("preserves local-only expenses not present in the incoming backup", async () => {
    await db.expenses.put(makeExpense({ id: "local-only" }));
    await backupQueries.mergeAll(emptyBackup());
    const stored = await db.expenses.get("local-only");
    expect(stored).toBeDefined();
  });

  it("does not let a stale cloud budget clobber a locally-edited one (regression)", async () => {
    // Local budget was edited at t=5000 (e.g. user raised the monthly limit)
    await db.budgets.put(makeBudget({ amount: 800, updatedAt: 5000 }));
    // Incoming cloud copy is stale — from before the edit
    await backupQueries.mergeAll(
      emptyBackup({ budgets: [makeBudget({ amount: 500, updatedAt: 1000 })] }),
    );
    const stored = await db.budgets.get("bud-1");
    expect(stored?.amount).toBe(800);
  });

  it("takes the incoming budget when it is newer than local", async () => {
    await db.budgets.put(makeBudget({ amount: 500, updatedAt: 1000 }));
    await backupQueries.mergeAll(
      emptyBackup({ budgets: [makeBudget({ amount: 750, updatedAt: 5000 })] }),
    );
    const stored = await db.budgets.get("bud-1");
    expect(stored?.amount).toBe(750);
  });

  it("falls back to createdAt for legacy budgets with no updatedAt", async () => {
    const legacyLocal = makeBudget({ amount: 500, createdAt: 1000 });
    // @ts-expect-error simulating a pre-migration record with no updatedAt
    delete legacyLocal.updatedAt;
    await db.budgets.put(legacyLocal);
    await backupQueries.mergeAll(
      emptyBackup({ budgets: [makeBudget({ amount: 900, createdAt: 2000, updatedAt: 2000 })] }),
    );
    const stored = await db.budgets.get("bud-1");
    expect(stored?.amount).toBe(900);
  });

  it("unions tags without dropping local-only tags", async () => {
    await db.tags.put(makeTag({ id: "local-tag", name: "Local" }));
    await backupQueries.mergeAll(
      emptyBackup({ tags: [makeTag({ id: "cloud-tag", name: "Cloud" })] }),
    );
    const all = await db.tags.toArray();
    expect(all.map((t) => t.id).sort()).toEqual(["cloud-tag", "local-tag"]);
  });

  it("ignores incoming default categories but upserts custom ones", async () => {
    await db.categories.put({
      id: "cat-default",
      name: "Food",
      icon: "🍔",
      color: "#f00",
      isDefault: true,
      createdAt: 1000,
    });
    await backupQueries.mergeAll(
      emptyBackup({
        categories: [
          // Incoming default category — should be ignored, never overwrites local defaults
          { id: "cat-default", name: "Changed", icon: "x", color: "#000", isDefault: true, createdAt: 1000 },
          // Incoming custom category — should be added
          { id: "cat-custom", name: "Hobbies", icon: "🎨", color: "#0f0", isDefault: false, createdAt: 1000 },
        ],
      }),
    );
    const defaultCat = await db.categories.get("cat-default");
    const customCat = await db.categories.get("cat-custom");
    expect(defaultCat?.name).toBe("Food");
    expect(customCat?.name).toBe("Hobbies");
  });
});
