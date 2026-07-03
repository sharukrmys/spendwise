import { db } from "./schema";
import type {
  Expense,
  Category,
  Tag,
  Budget,
  Group,
  GroupExpense,
  Task,
} from "@/core/types";
import { generateId } from "@/core/utils";

// ─── Expenses ───────────────────────────────────────────────────────
export const expenseQueries = {
  async getAll(): Promise<Expense[]> {
    return db.expenses.orderBy("date").reverse().toArray();
  },

  async getByRange(start: number, end: number): Promise<Expense[]> {
    return db.expenses
      .where("date")
      .between(start, end, true, true)
      .reverse()
      .sortBy("date");
  },

  async getByCategory(categoryId: string): Promise<Expense[]> {
    return db.expenses
      .where("categoryId")
      .equals(categoryId)
      .reverse()
      .sortBy("date");
  },

  async add(
    data: Omit<Expense, "id" | "createdAt" | "updatedAt">,
  ): Promise<Expense> {
    const now = Date.now();
    const expense: Expense = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await db.expenses.add(expense);
    return expense;
  },

  async update(id: string, data: Partial<Expense>): Promise<void> {
    await db.expenses.update(id, { ...data, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.expenses.delete(id);
  },

  async getByLinkedGroupExpense(geId: string): Promise<Expense | undefined> {
    return db.expenses.filter((e) => e.linkedGroupExpenseId === geId).first();
  },

  async search(query: string): Promise<Expense[]> {
    const q = query.toLowerCase();
    return db.expenses
      .filter(
        (e) =>
          (e.notes?.toLowerCase().includes(q) ?? false) ||
          e.amount.toString().includes(q),
      )
      .toArray();
  },

  async getRecurring(): Promise<Expense[]> {
    return db.expenses.filter((e) => e.isRecurring === true).toArray();
  },

  async getTotal(start?: number, end?: number): Promise<number> {
    const expenses =
      start && end ? await this.getByRange(start, end) : await this.getAll();
    return expenses.reduce((s, e) => s + e.amount, 0);
  },
};

// ─── Categories ─────────────────────────────────────────────────────
export const categoryQueries = {
  async getAll(): Promise<Category[]> {
    return db.categories.orderBy("name").toArray();
  },

  async getById(id: string): Promise<Category | undefined> {
    return db.categories.get(id);
  },

  async add(data: Omit<Category, "id" | "createdAt">): Promise<Category> {
    const cat: Category = { ...data, id: generateId(), createdAt: Date.now() };
    await db.categories.add(cat);
    return cat;
  },

  async update(id: string, data: Partial<Category>): Promise<void> {
    await db.categories.update(id, data);
  },

  async delete(id: string): Promise<void> {
    await db.categories.delete(id);
  },
};

// ─── Tags ────────────────────────────────────────────────────────────
export const tagQueries = {
  async getAll(): Promise<Tag[]> {
    return db.tags.orderBy("name").toArray();
  },

  async add(name: string, color: string): Promise<Tag> {
    const tag: Tag = { id: generateId(), name, color };
    await db.tags.add(tag);
    return tag;
  },

  async delete(id: string): Promise<void> {
    await db.tags.delete(id);
  },
};

// ─── Budgets ────────────────────────────────────────────────────────
export const budgetQueries = {
  async getAll(): Promise<Budget[]> {
    return db.budgets.toArray();
  },

  async add(data: Omit<Budget, "id" | "createdAt" | "updatedAt">): Promise<Budget> {
    const now = Date.now();
    const budget: Budget = { ...data, id: generateId(), createdAt: now, updatedAt: now };
    await db.budgets.add(budget);
    return budget;
  },

  async update(id: string, data: Partial<Budget>): Promise<void> {
    await db.budgets.update(id, { ...data, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.budgets.delete(id);
  },
};

// ─── Groups ─────────────────────────────────────────────────────────
export const groupQueries = {
  async getAll(): Promise<Group[]> {
    return db.groups.orderBy("createdAt").reverse().toArray();
  },

  async getById(id: string): Promise<Group | undefined> {
    return db.groups.get(id);
  },

  async add(
    data: Omit<Group, "id" | "createdAt" | "updatedAt">,
  ): Promise<Group> {
    const now = Date.now();
    const group: Group = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await db.groups.add(group);
    return group;
  },

  async update(id: string, data: Partial<Group>): Promise<void> {
    await db.groups.update(id, { ...data, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.groups.delete(id);
    await db.groupExpenses.where("groupId").equals(id).delete();
  },
};

// ─── Group Expenses ─────────────────────────────────────────────────
export const groupExpenseQueries = {
  async getByGroup(groupId: string): Promise<GroupExpense[]> {
    return db.groupExpenses
      .where("groupId")
      .equals(groupId)
      .reverse()
      .sortBy("date");
  },

  async add(
    data: Omit<GroupExpense, "id" | "createdAt">,
  ): Promise<GroupExpense> {
    const ge: GroupExpense = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
    };
    await db.groupExpenses.add(ge);
    return ge;
  },

  async update(id: string, data: Partial<GroupExpense>): Promise<void> {
    const existing = await db.groupExpenses.get(id);
    if (!existing) return;
    await db.groupExpenses.put({ ...existing, ...data });
  },

  async delete(id: string): Promise<void> {
    await db.groupExpenses.delete(id);
  },
};

// ─── Tasks ──────────────────────────────────────────────────────────
export const taskQueries = {
  async getAll(): Promise<Task[]> {
    return db.tasks.orderBy("createdAt").reverse().toArray();
  },

  async add(data: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
    const now = Date.now();
    const task: Task = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await db.tasks.add(task);
    return task;
  },

  async update(id: string, data: Partial<Task>): Promise<void> {
    await db.tasks.update(id, { ...data, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.tasks.delete(id);
  },

  async toggleItem(taskId: string, itemId: string): Promise<void> {
    const task = await db.tasks.get(taskId);
    if (!task?.items) return;
    const items = task.items.map((i) =>
      i.id === itemId ? { ...i, checked: !i.checked } : i,
    );
    await db.tasks.update(taskId, { items, updatedAt: Date.now() });
  },
};

// ─── Export / Import ────────────────────────────────────────────────
type BackupData = {
  version: number;
  exportedAt: number;
  expenses: Expense[];
  categories: Category[];
  tags: Tag[];
  budgets: Budget[];
  groups: Group[];
  groupExpenses: GroupExpense[];
  tasks: Task[];
};

export const backupQueries = {
  async exportAll(): Promise<BackupData> {
    const [expenses, categories, tags, budgets, groups, groupExpenses, tasks] =
      await Promise.all([
        db.expenses.toArray(),
        db.categories.toArray(),
        db.tags.toArray(),
        db.budgets.toArray(),
        db.groups.toArray(),
        db.groupExpenses.toArray(),
        db.tasks.toArray(),
      ]);
    return {
      version: 2,
      exportedAt: Date.now(),
      expenses,
      categories,
      tags,
      budgets,
      groups,
      groupExpenses,
      tasks,
    };
  },

  /**
   * Non-destructive merge: unions incoming cloud data with existing local data.
   * For each table, keeps the record with the newer updatedAt/createdAt when IDs
   * conflict. Local records not present in cloud are always preserved.
   * Use this for all sync flows (login, smart-sync) to prevent data loss.
   */
  async mergeAll(data: BackupData): Promise<void> {
    await db.transaction(
      "rw",
      [
        db.expenses,
        db.categories,
        db.tags,
        db.budgets,
        db.groups,
        db.groupExpenses,
        db.tasks,
      ],
      async () => {
        // Expenses: union by ID, newest updatedAt wins
        const localExpenses = await db.expenses.toArray();
        const expMap = new Map(localExpenses.map((e) => [e.id, e]));
        for (const inc of data.expenses) {
          const cur = expMap.get(inc.id);
          if (!cur || inc.updatedAt >= cur.updatedAt) expMap.set(inc.id, inc);
        }
        await db.expenses.bulkPut(Array.from(expMap.values()));

        // Custom categories: upsert by ID — never overwrite default categories
        const customCats = data.categories.filter(
          (c: Category) => !c.isDefault,
        );
        if (customCats.length) await db.categories.bulkPut(customCats);

        // Tags: upsert by ID. Tags are immutable after creation (no update
        // path), so a plain union by ID never loses an edit.
        if (data.tags.length) await db.tags.bulkPut(data.tags);

        // Budgets: union by ID, newest updatedAt wins (same recency rule as
        // expenses/groups/tasks) — a plain bulkPut here would let a stale
        // cloud copy silently clobber a budget edited locally after last sync.
        const localBudgets = await db.budgets.toArray();
        const budgetMap = new Map(localBudgets.map((b) => [b.id, b]));
        for (const inc of data.budgets) {
          const cur = budgetMap.get(inc.id);
          const incTs = inc.updatedAt ?? inc.createdAt;
          const curTs = cur ? (cur.updatedAt ?? cur.createdAt) : 0;
          if (!cur || incTs >= curTs) budgetMap.set(inc.id, inc);
        }
        await db.budgets.bulkPut(Array.from(budgetMap.values()));

        // Groups: union by ID, newest updatedAt wins
        const localGroups = await db.groups.toArray();
        const groupMap = new Map(localGroups.map((g) => [g.id, g]));
        for (const inc of data.groups) {
          const cur = groupMap.get(inc.id);
          if (!cur || inc.updatedAt >= cur.updatedAt) groupMap.set(inc.id, inc);
        }
        await db.groups.bulkPut(Array.from(groupMap.values()));

        // GroupExpenses: union by ID, newest updatedAt/createdAt wins
        const localGE = await db.groupExpenses.toArray();
        const geMap = new Map(localGE.map((e) => [e.id, e]));
        for (const inc of data.groupExpenses) {
          const cur = geMap.get(inc.id);
          const incTs = inc.updatedAt ?? inc.createdAt;
          const curTs = cur ? (cur.updatedAt ?? cur.createdAt) : 0;
          if (!cur || incTs >= curTs) geMap.set(inc.id, inc);
        }
        await db.groupExpenses.bulkPut(Array.from(geMap.values()));

        // Tasks: union by ID, newest updatedAt wins
        const localTasks = await db.tasks.toArray();
        const taskMap = new Map(localTasks.map((t) => [t.id, t]));
        for (const inc of data.tasks ?? []) {
          const cur = taskMap.get(inc.id);
          if (!cur || inc.updatedAt >= cur.updatedAt) taskMap.set(inc.id, inc);
        }
        await db.tasks.bulkPut(Array.from(taskMap.values()));
      },
    );
  },

  /**
   * Destructive full restore: clears local data and replaces with backup.
   * Only use for explicit "Restore from Drive" action — never for auto-sync.
   */
  async importAll(data: BackupData): Promise<void> {
    await db.transaction(
      "rw",
      [
        db.expenses,
        db.categories,
        db.tags,
        db.budgets,
        db.groups,
        db.groupExpenses,
        db.tasks,
      ],
      async () => {
        await Promise.all([
          db.expenses.clear(),
          db.tags.clear(),
          db.budgets.clear(),
          db.groups.clear(),
          db.groupExpenses.clear(),
          db.tasks.clear(),
        ]);
        // Keep default categories, merge custom ones
        const customCats = data.categories.filter(
          (c: Category) => !c.isDefault,
        );
        if (customCats.length) await db.categories.bulkPut(customCats);
        await db.expenses.bulkPut(data.expenses);
        await db.tags.bulkPut(data.tags);
        await db.budgets.bulkPut(data.budgets);
        await db.groups.bulkPut(data.groups);
        await db.groupExpenses.bulkPut(data.groupExpenses);
        if (data.tasks?.length) await db.tasks.bulkPut(data.tasks);
      },
    );
  },
};
