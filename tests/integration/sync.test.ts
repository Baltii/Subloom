import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { commit, hydrate, saveSubscription, useApp } from "../../src/store/app";
import {
  resolveConflict,
  syncNow,
  watchAccountChanges,
} from "../../src/services/sync";
import {
  emptySnapshot,
  type Operation,
  type Snapshot,
} from "../../src/domain/models";
import { subscription, userA, userB } from "../fixtures";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-crypto", () => ({ randomUUID }));
vi.mock("../../src/services/supabase", () => ({
  accountClient: vi.fn(async (identity: string) => client(identity)),
  supabase: { channel: () => channel, removeChannel: vi.fn(async () => {}) },
}));
const disk = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => disk.get(key) || null,
  setItem: (key: string, value: string) => disk.set(key, value),
  removeItem: (key: string) => disk.delete(key),
});
const cloud = new Map<string, Snapshot>();
const revisions = new Map<string, number>();
const applied = new Set<string>();
const requests: {
  owner: string;
  table: string;
  filters: Record<string, string>;
}[] = [];
let beforeRead: ((owner: string, table: string) => Promise<void>) | undefined;
let beforeWrite: (() => Promise<void>) | undefined;
let onChange: (() => void) | undefined;
const channel = {
  on: vi.fn((_event: string, _filter: unknown, changed: () => void) => {
    onChange = changed;
    return channel;
  }),
  subscribe: vi.fn(() => channel),
};
function defer() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function client(owner: string) {
  return {
    rpc: async (_name: string, { operation }: { operation: Operation }) => {
      await beforeWrite?.();
      const state = cloud.get(owner)!;
      if (!applied.has(operation.id)) {
        const row = state.subscriptions.find(
          (s) => s.id === operation.entityId,
        );
        if ((row?.version ?? null) !== operation.expectedVersion)
          return { error: { message: "Sync conflict" }, data: null };
        if (operation.action === "delete")
          state.subscriptions = state.subscriptions.filter(
            (s) => s.id !== operation.entityId,
          );
        else {
          const payload = operation.payload as {
            subscription: ReturnType<typeof subscription>;
          };
          state.subscriptions = [
            ...state.subscriptions.filter((s) => s.id !== operation.entityId),
            {
              ...payload.subscription,
              userId: owner,
              version: (row?.version ?? 0) + 1,
            },
          ];
        }
        applied.add(operation.id);
        revisions.set(owner, (revisions.get(owner) ?? 0) + 1);
      }
      return { error: null, data: { ok: true } };
    },
    from: (table: string) => {
      const filters: Record<string, string> = {};
      let single = false,
        select = "data",
        offset = 0,
        end = 499;
      const query = {
        select: (value: string) => {
          select = value;
          return query;
        },
        eq: (key: string, value: string) => {
          filters[key] = value;
          return query;
        },
        order: () => query,
        range: (start: number, finish: number) => {
          offset = start;
          end = finish;
          return query;
        },
        maybeSingle: () => {
          single = true;
          return query;
        },
        then: (
          resolve: (result: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) =>
          (async () => {
            requests.push({ owner, table, filters: { ...filters } });
            await beforeRead?.(owner, table);
            const state = cloud.get(owner)!;
            if (table === "account_sync_state")
              return {
                data: { revision: revisions.get(owner) ?? 0 },
                error: null,
              };
            if (table === "user_preferences")
              return {
                data: state.onboarded
                  ? { data: structuredClone(state.preferences) }
                  : null,
                error: null,
              };
            const source =
              table === "subscriptions"
                ? state.subscriptions
                : table === "detected_candidates"
                  ? state.candidates
                  : state.activity;
            const rows = source
              .filter((row) => !filters.id || row.id === filters.id)
              .slice(offset, end + 1)
              .map((row) =>
                select === "version"
                  ? {
                      version: (row as ReturnType<typeof subscription>).version,
                    }
                  : { data: structuredClone(row) },
              );
            return { data: single ? (rows[0] ?? null) : rows, error: null };
          })().then(resolve, reject),
      };
      return query;
    },
  };
}
beforeEach(async () => {
  await syncNow().catch(() => {});
  disk.clear();
  cloud.clear();
  applied.clear();
  requests.length = 0;
  revisions.clear();
  beforeRead = undefined;
  beforeWrite = undefined;
  onChange = undefined;
  vi.clearAllMocks();
  cloud.set(userA, emptySnapshot());
  cloud.set(userB, emptySnapshot());
  await hydrate(userA);
});
describe("account sync under concurrency and intermittent connectivity", () => {
  it("hydrates an existing account on a second device without repeating onboarding", async () => {
    cloud.get(userA)!.subscriptions = [subscription()];
    await syncNow();
    expect(useApp.getState().data.subscriptions).toHaveLength(1);
    expect(useApp.getState().data.onboarded).toBe(true);
    expect(requests.every((r) => r.filters.user_id === r.owner)).toBe(true);
  });
  it("keeps queued changes on failure and replays them safely after reconnect", async () => {
    await saveSubscription(subscription());
    beforeWrite = async () => {
      throw new Error("Offline");
    };
    await expect(syncNow()).rejects.toThrow("Offline");
    expect(useApp.getState().data.outbox).toHaveLength(1);
    beforeWrite = undefined;
    await syncNow();
    expect(cloud.get(userA)!.subscriptions).toHaveLength(1);
    expect(useApp.getState().data.outbox).toHaveLength(0);
  });
  it("never uploads the next account's outbox through the old account client", async () => {
    const started = defer(),
      release = defer();
    await saveSubscription(subscription());
    beforeWrite = async () => {
      started.resolve();
      await release.promise;
    };
    const syncing = syncNow();
    await started.promise;
    await hydrate(userB);
    await saveSubscription(
      subscription({ id: randomUUID(), name: "Account B" }),
    );
    const again = syncNow();
    release.resolve();
    await Promise.all([syncing, again]);
    expect(cloud.get(userA)!.subscriptions.map((s) => s.name)).not.toContain(
      "Account B",
    );
    expect(cloud.get(userB)!.subscriptions[0]?.userId).toBe(userB);
    expect(useApp.getState().data.subscriptions[0]?.name).toBe("Account B");
  });
  it("does not commit an old account's response into the new account cache", async () => {
    cloud.get(userA)!.subscriptions = [subscription()];
    const started = defer(),
      release = defer();
    beforeRead = async (owner, table) => {
      if (owner === userA && table === "subscriptions") {
        started.resolve();
        await release.promise;
      }
    };
    const syncing = syncNow();
    await started.promise;
    await hydrate(userB);
    release.resolve();
    await syncing;
    expect(useApp.getState().identity).toBe(userB);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
    await hydrate(userA);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
  });
  it("retries when a remote deletion occurs while the pull is in progress", async () => {
    cloud.get(userA)!.subscriptions = [subscription()];
    let reads = 0;
    beforeRead = async (_owner, table) => {
      if (table === "account_sync_state" && ++reads === 2) {
        cloud.get(userA)!.subscriptions = [];
        revisions.set(userA, 1);
      }
    };
    await syncNow();
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
    expect(reads).toBe(4);
  });
  it("drains a local edit made during the pull rather than replacing it", async () => {
    let edited = false;
    beforeRead = async (_owner, table) => {
      if (table === "subscriptions" && !edited) {
        edited = true;
        await saveSubscription(subscription());
      }
    };
    await syncNow();
    expect(cloud.get(userA)!.subscriptions).toHaveLength(1);
    expect(useApp.getState().data.outbox).toHaveLength(0);
  });
  it("retains both competing versions until the user explicitly chooses", async () => {
    cloud.get(userA)!.subscriptions = [
      subscription({ version: 2, name: "Other device" }),
    ];
    await saveSubscription(subscription({ name: "Local device" }));
    await expect(syncNow()).rejects.toThrow(/conflict/);
    expect(useApp.getState().data.subscriptions[0]?.name).toBe("Local device");
    await resolveConflict("remote");
    expect(useApp.getState().data.subscriptions[0]?.name).toBe("Other device");
    expect(useApp.getState().data.outbox).toHaveLength(0);
  });
  it("rebases an explicit local choice on the current cloud version", async () => {
    cloud.get(userA)!.subscriptions = [
      subscription({ version: 2, name: "Other device" }),
    ];
    await saveSubscription(subscription({ name: "Local device" }));
    await expect(syncNow()).rejects.toThrow(/conflict/);
    await resolveConflict("local");
    expect(cloud.get(userA)!.subscriptions[0]).toMatchObject({
      name: "Local device",
      version: 3,
    });
  });
  it("rejects a delayed commit bound to a different identity", async () => {
    await hydrate(userB);
    await expect(
      commit((data) => ({ ...data, onboarded: true }), userA),
    ).rejects.toThrow(/account changed/);
    expect(useApp.getState().data.onboarded).toBe(false);
  });
  it("coalesces Realtime events and removes the listener on sign-out", async () => {
    vi.useFakeTimers();
    try {
      const refresh = vi.fn(),
        dispose = watchAccountChanges(userA, refresh);
      onChange?.();
      onChange?.();
      onChange?.();
      await vi.advanceTimersByTimeAsync(250);
      expect(refresh).toHaveBeenCalledTimes(1);
      onChange?.();
      dispose();
      await vi.advanceTimersByTimeAsync(250);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
