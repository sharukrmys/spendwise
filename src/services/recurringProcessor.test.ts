import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/schema";
import { expenseQueries } from "@/db/queries";
import {
  nextOccurrence,
  effectiveNextDate,
  processRecurringExpenses,
  markSubscriptionPaid,
  undoMarkSubscriptionPaid,
} from "./recurringProcessor";
import type { Expense } from "@/core/types";

const DAY = 86400000;

function makeTemplate(overrides: Partial<Expense> = {}): Expense {
  const now = Date.now();
  return {
    id: "template-1",
    type: "expense",
    amount: 100,
    currency: "USD",
    categoryId: "cat-1",
    tags: [],
    date: now - 40 * DAY,
    paymentMethod: "card",
    isRecurring: true,
    recurrence: { interval: "monthly" },
    createdAt: now - 40 * DAY,
    updatedAt: now - 40 * DAY,
    ...overrides,
  };
}

beforeEach(async () => {
  await db.expenses.clear();
});

describe("nextOccurrence", () => {
  it("advances by the given interval", () => {
    const d = new Date("2026-01-15T00:00:00Z").getTime();
    expect(new Date(nextOccurrence(d, "daily")).toISOString()).toContain("2026-01-16");
    expect(new Date(nextOccurrence(d, "weekly")).toISOString()).toContain("2026-01-22");
    expect(new Date(nextOccurrence(d, "monthly")).toISOString()).toContain("2026-02-15");
    expect(new Date(nextOccurrence(d, "yearly")).toISOString()).toContain("2027-01-15");
  });
});

describe("effectiveNextDate", () => {
  it("uses the stored nextDate when present", () => {
    const e = makeTemplate({ recurrence: { interval: "monthly", nextDate: 12345 } });
    expect(effectiveNextDate(e)).toBe(12345);
  });

  it("derives from date + interval when nextDate has never been set", () => {
    const e = makeTemplate({ date: 1000, recurrence: { interval: "daily" } });
    expect(effectiveNextDate(e)).toBe(nextOccurrence(1000, "daily"));
  });
});

describe("processRecurringExpenses", () => {
  it("creates one instance per elapsed interval and advances nextDate", async () => {
    // Template due monthly, last occurrence ~40 days ago with no stored nextDate yet
    const template = makeTemplate();
    await db.expenses.put(template);

    const created = await processRecurringExpenses();

    expect(created).toBe(1); // only one monthly cycle has elapsed in 40 days
    const all = await expenseQueries.getAll();
    const instances = all.filter((e) => !e.isRecurring);
    expect(instances).toHaveLength(1);
    expect(instances[0].amount).toBe(100);

    const updatedTemplate = await db.expenses.get("template-1");
    expect(updatedTemplate?.recurrence?.nextDate).toBeGreaterThan(Date.now() - DAY);
  });

  it("caps backfill at 12 instances for long offline gaps", async () => {
    const template = makeTemplate({
      date: Date.now() - 400 * DAY, // ~13 months of missed daily occurrences
      recurrence: { interval: "daily" },
    });
    await db.expenses.put(template);

    const created = await processRecurringExpenses();

    expect(created).toBe(12);
  });

  it("does not create instances past the recurrence endDate", async () => {
    const template = makeTemplate({
      date: Date.now() - 40 * DAY,
      recurrence: { interval: "monthly", endDate: Date.now() - 35 * DAY },
    });
    await db.expenses.put(template);

    const created = await processRecurringExpenses();

    expect(created).toBe(0);
  });

  it("is idempotent — running twice in a row does not double-create", async () => {
    const template = makeTemplate();
    await db.expenses.put(template);

    await processRecurringExpenses();
    const secondRunCreated = await processRecurringExpenses();

    expect(secondRunCreated).toBe(0);
  });
});

describe("markSubscriptionPaid / undoMarkSubscriptionPaid", () => {
  it("records a transaction and advances nextDate from the scheduled date, not from now", async () => {
    const scheduledDate = Date.now() - 2 * DAY; // was due 2 days ago
    const template = makeTemplate({
      date: scheduledDate,
      recurrence: { interval: "monthly", nextDate: scheduledDate },
    });
    await db.expenses.put(template);

    const result = await markSubscriptionPaid(template);

    expect(result.created.date).toBeGreaterThan(Date.now() - DAY); // paid "now"
    const updatedTemplate = await db.expenses.get("template-1");
    // Next cycle should be one month past the *scheduled* date, not past "now"
    expect(updatedTemplate?.recurrence?.nextDate).toBe(nextOccurrence(scheduledDate, "monthly"));
  });

  it("undo removes the created transaction and restores prior amount + recurrence", async () => {
    const template = makeTemplate({ amount: 100 });
    await db.expenses.put(template);

    const result = await markSubscriptionPaid(template, { amount: 150 });
    const bumped = await db.expenses.get("template-1");
    expect(bumped?.amount).toBe(150);

    await undoMarkSubscriptionPaid(result);

    const restored = await db.expenses.get("template-1");
    expect(restored?.amount).toBe(100);
    const deletedInstance = await db.expenses.get(result.created.id);
    expect(deletedInstance).toBeUndefined();
  });
});
