import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db/schema";
import type { Group, GroupExpense } from "@/core/types";

vi.mock("@/services/googleSync", () => ({
  createSharedGroupFile: vi.fn(),
  readSharedGroupFile: vi.fn(),
  writeSharedGroupFile: vi.fn(),
  deleteSharedGroupFile: vi.fn(),
}));

// Import after the mock so the store picks up the mocked module
const { useGroupStore } = await import("./useGroupStore");
const googleSync = await import("@/services/googleSync");

function resetStore() {
  useGroupStore.setState({
    groups: [],
    activeGroupId: null,
    groupExpenses: {},
    loading: false,
    syncingGroupId: null,
  });
}

const baseGroup: Group = {
  id: "g1",
  name: "Trip",
  members: [
    { id: "m1", name: "Alice", avatarColor: "#111" },
    { id: "m2", name: "Bob", avatarColor: "#222" },
  ],
  currency: "USD",
  createdAt: 1000,
  updatedAt: 1000,
};

function makeGroupExpense(overrides: Partial<GroupExpense> = {}): GroupExpense {
  return {
    id: "ge1",
    groupId: "g1",
    description: "Dinner",
    amount: 100,
    currency: "USD",
    paidBy: "m1",
    splits: [
      { memberId: "m1", amount: 50, settled: false },
      { memberId: "m2", amount: 50, settled: false },
    ],
    date: 1000,
    createdAt: 1000,
    ...overrides,
  };
}

beforeEach(async () => {
  resetStore();
  vi.clearAllMocks();
  await Promise.all([db.groups.clear(), db.groupExpenses.clear()]);
});

describe("getBalances", () => {
  it("shows the payer as owed by the other member for an unsettled split", () => {
    useGroupStore.setState({ groupExpenses: { g1: [makeGroupExpense()] } });
    const balances = useGroupStore.getState().getBalances("g1");
    expect(balances.m1).toBe(50); // Alice paid, is owed 50 by Bob
    expect(balances.m2).toBe(-50); // Bob owes 50
  });

  it("excludes settled splits from the balance", () => {
    useGroupStore.setState({
      groupExpenses: {
        g1: [
          makeGroupExpense({
            splits: [
              { memberId: "m1", amount: 50, settled: false },
              { memberId: "m2", amount: 50, settled: true },
            ],
          }),
        ],
      },
    });
    const balances = useGroupStore.getState().getBalances("g1");
    expect(balances.m1 ?? 0).toBe(0);
    expect(balances.m2 ?? 0).toBe(0);
  });

  it("applies a direct settlement record between payer and creditor", () => {
    useGroupStore.setState({
      groupExpenses: {
        g1: [
          makeGroupExpense(), // Alice owed 50 by Bob
          makeGroupExpense({
            id: "settlement-1",
            notes: "__settlement__",
            paidBy: "m2", // Bob pays back
            amount: 50,
            splits: [{ memberId: "m1", amount: 50, settled: true }], // to Alice
          }),
        ],
      },
    });
    const balances = useGroupStore.getState().getBalances("g1");
    expect(balances.m1 ?? 0).toBe(0);
    expect(balances.m2 ?? 0).toBe(0);
  });

  it("ignores invalidated (voided) settlements", () => {
    useGroupStore.setState({
      groupExpenses: {
        g1: [
          makeGroupExpense(),
          makeGroupExpense({
            id: "settlement-1",
            notes: "__settlement__",
            paidBy: "m2",
            amount: 50,
            splits: [{ memberId: "m1", amount: 50, settled: true }],
            invalidated: true,
          }),
        ],
      },
    });
    const balances = useGroupStore.getState().getBalances("g1");
    // Voided settlement should not offset the original debt
    expect(balances.m1).toBe(50);
    expect(balances.m2).toBe(-50);
  });
});

describe("syncSharedGroup", () => {
  it("merges remote and local expenses by id, newest createdAt winning, and unions members", async () => {
    await db.groups.put({ ...baseGroup, shareCode: "file-123", isOwner: true });
    const localGE = makeGroupExpense({ id: "local-only", createdAt: 1000 });
    const conflictingLocal = makeGroupExpense({ id: "conflict", amount: 10, createdAt: 1000 });

    useGroupStore.setState({
      groups: [{ ...baseGroup, shareCode: "file-123", isOwner: true }],
      groupExpenses: { g1: [localGE, conflictingLocal] },
    });

    const remoteNewerConflict = makeGroupExpense({ id: "conflict", amount: 999, createdAt: 5000 });
    const remoteOnly = makeGroupExpense({ id: "remote-only", createdAt: 1000 });
    const newMember = { id: "m3", name: "Carol", avatarColor: "#333" };

    vi.mocked(googleSync.readSharedGroupFile).mockResolvedValue({
      group: { ...baseGroup, members: [...baseGroup.members, newMember] },
      expenses: [remoteNewerConflict, remoteOnly],
      syncedAt: Date.now(),
    });
    vi.mocked(googleSync.writeSharedGroupFile).mockResolvedValue(undefined);

    await useGroupStore.getState().syncSharedGroup("g1");

    const merged = useGroupStore.getState().groupExpenses.g1;
    const byId = Object.fromEntries(merged.map((e) => [e.id, e]));

    expect(byId["local-only"]).toBeDefined();
    expect(byId["remote-only"]).toBeDefined();
    expect(byId["conflict"].amount).toBe(999); // remote's newer createdAt wins

    const mergedGroup = useGroupStore.getState().groups.find((g) => g.id === "g1")!;
    expect(mergedGroup.members.map((m) => m.id).sort()).toEqual(["m1", "m2", "m3"]);

    // Should push the merged result back to Drive
    expect(googleSync.writeSharedGroupFile).toHaveBeenCalledWith(
      "file-123",
      expect.objectContaining({ expenses: expect.any(Array) }),
    );
  });

  it("throws if the group has no shareCode", async () => {
    useGroupStore.setState({ groups: [baseGroup] }); // no shareCode
    await expect(useGroupStore.getState().syncSharedGroup("g1")).rejects.toThrow(
      "Group is not shared",
    );
  });
});
