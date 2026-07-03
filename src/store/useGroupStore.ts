import { create } from "zustand";
import type { Group, GroupExpense, GroupMember } from "@/core/types";
import { groupQueries, groupExpenseQueries } from "@/db/queries";
import { generateId, avatarColor } from "@/core/utils";
import {
  createSharedGroupFile,
  readSharedGroupFile,
  writeSharedGroupFile,
  deleteSharedGroupFile,
  grantMemberAccess,
} from "@/services/googleSync";

interface GroupState {
  groups: Group[];
  activeGroupId: string | null;
  groupExpenses: Record<string, GroupExpense[]>;
  loading: boolean;
  syncingGroupId: string | null;

  load: () => Promise<void>;
  setActiveGroup: (id: string | null) => void;
  loadGroupExpenses: (groupId: string) => Promise<void>;
  loadAllGroupExpenses: () => Promise<void>;
  addGroup: (
    name: string,
    description?: string,
    currency?: string,
  ) => Promise<Group>;
  updateGroup: (id: string, data: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addMember: (
    groupId: string,
    name: string,
    email?: string,
  ) => Promise<GroupMember>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;
  /** Mark a member as "me" on this device. Local-only, not synced to other members. */
  setMyMember: (groupId: string, memberId: string | undefined) => Promise<void>;
  addGroupExpense: (
    data: Omit<GroupExpense, "id" | "createdAt">,
  ) => Promise<GroupExpense>;
  updateGroupExpense: (
    groupId: string,
    expenseId: string,
    data: Partial<GroupExpense>,
  ) => Promise<void>;
  deleteGroupExpense: (groupId: string, expenseId: string) => Promise<void>;
  settleUp: (
    groupId: string,
    expenseId: string,
    memberId: string,
    settledBy?: string,
  ) => Promise<void>;
  unsettle: (
    groupId: string,
    expenseId: string,
    memberId: string,
  ) => Promise<void>;
  getBalances: (groupId: string) => Record<string, number>;
  /** Create a shared Drive file for the group. Returns the share code (Drive file ID). */
  shareGroup: (groupId: string) => Promise<string>;
  /** Import a group from a share code (Drive file ID) entered by another user. */
  joinGroup: (shareCode: string) => Promise<Group>;
  /** Pull latest state from Drive, merge expenses, push back. */
  syncSharedGroup: (groupId: string) => Promise<void>;
  /** Remove the shared Drive file and clear shareCode (owner only). */
  unshareGroup: (groupId: string) => Promise<void>;
  /** Soft-archive a group (hide from main list, preserve data). */
  archiveGroup: (groupId: string) => Promise<void>;
  /** Restore an archived group to the active list. */
  unarchiveGroup: (groupId: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroupId: null,
  groupExpenses: {},
  loading: false,
  syncingGroupId: null,

  load: async () => {
    set({ loading: true });
    const groups = await groupQueries.getAll();
    set({ groups, loading: false });
  },

  setActiveGroup: (id) => set({ activeGroupId: id }),

  loadGroupExpenses: async (groupId) => {
    const expenses = await groupExpenseQueries.getByGroup(groupId);
    set((s) => ({
      groupExpenses: { ...s.groupExpenses, [groupId]: expenses },
    }));
  },

  loadAllGroupExpenses: async () => {
    const groups = get().groups;
    const entries = await Promise.all(
      groups.map(
        async (g) =>
          [g.id, await groupExpenseQueries.getByGroup(g.id)] as const,
      ),
    );
    const map = Object.fromEntries(entries);
    set((s) => ({ groupExpenses: { ...s.groupExpenses, ...map } }));
  },

  addGroup: async (name, description, currency = "USD") => {
    const group = await groupQueries.add({
      name,
      description,
      members: [],
      currency,
    });
    set((s) => ({ groups: [group, ...s.groups] }));
    return group;
  },

  updateGroup: async (id, data) => {
    await groupQueries.update(id, data);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, ...data } : g)),
    }));
  },

  deleteGroup: async (id) => {
    await groupQueries.delete(id);
    set((s) => {
      const { [id]: _, ...rest } = s.groupExpenses;
      return {
        groups: s.groups.filter((g) => g.id !== id),
        groupExpenses: rest,
      };
    });
  },

  addMember: async (groupId, name, email) => {
    const member: GroupMember = {
      id: generateId(),
      name,
      email,
      avatarColor: avatarColor(name),
    };
    const group = get().groups.find((g) => g.id === groupId);
    if (!group) return member;
    const updated = { ...group, members: [...group.members, member] };
    await groupQueries.update(groupId, { members: updated.members });
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? updated : g)),
    }));
    // Group is already shared and this device has write access to the Drive
    // file — best-effort grant the new member's email so they can Picker-open
    // it too. Requires `email` and `writersCanShare` (Drive's default); safe
    // to fail silently if this device isn't the owner and can't grant access.
    if (group.shareCode && email) {
      grantMemberAccess(group.shareCode, email).catch((e) => console.error(e));
    }
    return member;
  },

  removeMember: async (groupId, memberId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group) return;
    const members = group.members.filter((m) => m.id !== memberId);
    const clearMe = group.myMemberId === memberId;
    await groupQueries.update(groupId, {
      members,
      ...(clearMe ? { myMemberId: undefined } : {}),
    });
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId
          ? { ...g, members, ...(clearMe ? { myMemberId: undefined } : {}) }
          : g,
      ),
    }));
  },

  setMyMember: async (groupId, memberId) => {
    await groupQueries.update(groupId, { myMemberId: memberId });
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, myMemberId: memberId } : g,
      ),
    }));
  },

  addGroupExpense: async (data) => {
    const ge = await groupExpenseQueries.add(data);
    set((s) => ({
      groupExpenses: {
        ...s.groupExpenses,
        [data.groupId]: [ge, ...(s.groupExpenses[data.groupId] ?? [])],
      },
    }));
    return ge;
  },

  updateGroupExpense: async (groupId, expenseId, data) => {
    const patch = { ...data, updatedAt: Date.now() };
    await groupExpenseQueries.update(expenseId, patch);
    set((s) => ({
      groupExpenses: {
        ...s.groupExpenses,
        [groupId]: (s.groupExpenses[groupId] ?? []).map((e) =>
          e.id === expenseId ? { ...e, ...patch } : e,
        ),
      },
    }));
  },

  deleteGroupExpense: async (groupId, expenseId) => {
    await groupExpenseQueries.delete(expenseId);
    set((s) => ({
      groupExpenses: {
        ...s.groupExpenses,
        [groupId]: (s.groupExpenses[groupId] ?? []).filter(
          (e) => e.id !== expenseId,
        ),
      },
    }));
  },

  settleUp: async (groupId, expenseId, memberId, settledBy?: string) => {
    const expenses = get().groupExpenses[groupId] ?? [];
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    const now = Date.now();
    const splits = expense.splits.map((s) =>
      s.memberId === memberId
        ? {
            ...s,
            settled: true,
            settledAt: now,
            settledBy: settledBy ?? memberId,
          }
        : s,
    );
    await groupExpenseQueries.update(expenseId, { splits });
    set((s) => ({
      groupExpenses: {
        ...s.groupExpenses,
        [groupId]: expenses.map((e) =>
          e.id === expenseId ? { ...e, splits } : e,
        ),
      },
    }));
  },

  unsettle: async (groupId: string, expenseId: string, memberId: string) => {
    const expenses = get().groupExpenses[groupId] ?? [];
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    const splits = expense.splits.map((s) =>
      s.memberId === memberId
        ? { ...s, settled: false, settledAt: undefined, settledBy: undefined }
        : s,
    );
    await groupExpenseQueries.update(expenseId, { splits });
    set((s) => ({
      groupExpenses: {
        ...s.groupExpenses,
        [groupId]: expenses.map((e) =>
          e.id === expenseId ? { ...e, splits } : e,
        ),
      },
    }));
  },

  // Calculate how much each member owes/is owed (positive = owed, negative = owes)
  getBalances: (groupId) => {
    const expenses = get().groupExpenses[groupId] ?? [];
    const balances: Record<string, number> = {};

    for (const e of expenses) {
      if (e.notes === "__settlement__") {
        if (e.invalidated) continue; // voided settlements don't affect balances
        // Direct payment record: debtor (paidBy) paid creditor (splits[0].memberId)
        const creditorId = e.splits[0]?.memberId;
        if (creditorId && creditorId !== e.paidBy) {
          balances[e.paidBy] = (balances[e.paidBy] ?? 0) + e.amount;
          balances[creditorId] = (balances[creditorId] ?? 0) - e.amount;
        }
      } else {
        // Regular expense: payer is owed each unsettled non-self split
        for (const split of e.splits) {
          if (split.memberId === e.paidBy || split.settled) continue;
          balances[e.paidBy] = (balances[e.paidBy] ?? 0) + split.amount;
          balances[split.memberId] =
            (balances[split.memberId] ?? 0) - split.amount;
        }
      }
    }

    return balances;
  },

  shareGroup: async (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group) throw new Error("Group not found");
    set({ syncingGroupId: groupId });
    try {
      const expenses =
        get().groupExpenses[groupId] ??
        (await groupExpenseQueries.getByGroup(groupId));
      const payload = { group, expenses, syncedAt: Date.now() };
      const memberEmails = group.members
        .map((m) => m.email)
        .filter((e): e is string => !!e);
      const fileId = await createSharedGroupFile(groupId, group.name, payload, memberEmails);
      const updated = { ...group, shareCode: fileId, isOwner: true };
      await groupQueries.update(groupId, { shareCode: fileId, isOwner: true });
      set((s) => ({
        groups: s.groups.map((g) => (g.id === groupId ? updated : g)),
        syncingGroupId: null,
      }));
      return fileId;
    } catch (e) {
      set({ syncingGroupId: null });
      throw e;
    }
  },

  joinGroup: async (shareCode) => {
    set({ syncingGroupId: "joining" });
    try {
      const payload = (await readSharedGroupFile(shareCode)) as {
        group: Group;
        expenses: GroupExpense[];
      } | null;
      if (!payload?.group)
        throw new Error("Invalid share code or group not found");
      // Save group locally, marking as a non-owner member. put() upserts by id —
      // works whether this is the first join or a re-join of an existing local group.
      const group: Group = { ...payload.group, shareCode, isOwner: false };
      const db = (await import("@/db/schema")).db;
      await db.groups.put(group);
      // Save expenses
      if (payload.expenses?.length) {
        await db.groupExpenses.bulkPut(payload.expenses);
      }
      set((s) => ({
        groups: s.groups.find((g) => g.id === group.id)
          ? s.groups.map((g) => (g.id === group.id ? group : g))
          : [group, ...s.groups],
        groupExpenses: {
          ...s.groupExpenses,
          [group.id]: payload.expenses ?? [],
        },
        syncingGroupId: null,
      }));
      return group;
    } catch (e) {
      set({ syncingGroupId: null });
      throw e;
    }
  },

  syncSharedGroup: async (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group?.shareCode) throw new Error("Group is not shared");
    set({ syncingGroupId: groupId });
    try {
      // Pull latest from Drive
      const remote = (await readSharedGroupFile(group.shareCode)) as {
        group: Group;
        expenses: GroupExpense[];
        syncedAt: number;
      } | null;
      const localExpenses =
        get().groupExpenses[groupId] ??
        (await groupExpenseQueries.getByGroup(groupId));

      // Merge expenses: union by id, newest createdAt wins
      const expenseMap = new Map<string, GroupExpense>();
      for (const e of remote?.expenses ?? []) expenseMap.set(e.id, e);
      for (const e of localExpenses) {
        const existing = expenseMap.get(e.id);
        if (!existing || e.createdAt > existing.createdAt)
          expenseMap.set(e.id, e);
      }
      const merged = Array.from(expenseMap.values());

      // Merge group members: union by id
      const remoteMembers = remote?.group?.members ?? [];
      const memberMap = new Map(group.members.map((m) => [m.id, m]));
      for (const m of remoteMembers)
        if (!memberMap.has(m.id)) memberMap.set(m.id, m);
      const mergedGroup: Group = {
        ...group,
        members: Array.from(memberMap.values()),
        updatedAt: Date.now(),
      };

      // Persist locally
      const db = (await import("@/db/schema")).db;
      await db.groups.put(mergedGroup);
      await db.groupExpenses.bulkPut(merged);

      // Push merged state back to Drive
      const payload = {
        group: mergedGroup,
        expenses: merged,
        syncedAt: Date.now(),
      };
      await writeSharedGroupFile(group.shareCode, payload);

      set((s) => ({
        groups: s.groups.map((g) => (g.id === groupId ? mergedGroup : g)),
        groupExpenses: { ...s.groupExpenses, [groupId]: merged },
        syncingGroupId: null,
      }));
    } catch (e) {
      set({ syncingGroupId: null });
      throw e;
    }
  },

  unshareGroup: async (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group?.shareCode) return;
    if (group.isOwner) {
      await deleteSharedGroupFile(group.shareCode).catch(() => {});
    }
    await groupQueries.update(groupId, {
      shareCode: undefined,
      isOwner: false,
    });
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, shareCode: undefined, isOwner: false } : g,
      ),
    }));
  },

  archiveGroup: async (groupId) => {
    await groupQueries.update(groupId, { archived: true })
    set((s) => ({
      groups: s.groups.map((g) => g.id === groupId ? { ...g, archived: true } : g),
    }))
  },

  unarchiveGroup: async (groupId) => {
    await groupQueries.update(groupId, { archived: false })
    set((s) => ({
      groups: s.groups.map((g) => g.id === groupId ? { ...g, archived: false } : g),
    }))
  },
}));
