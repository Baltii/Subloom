import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  addCandidate,
  commit,
  dismissCandidate,
  finishOnboarding,
  hydrate,
  importGuestData,
  saveSubscription,
  useApp,
  changeStatus,
  deleteSubscription,
} from "../../src/store/app";
import { extractReceipt } from "../../src/domain/detection";
import { defaultPreferences } from "../../src/domain/models";
import { subscription, userA, userB } from "../fixtures";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-crypto", () => ({ randomUUID }));
const disk = new Map<string, string>();
let failWrites = false;
vi.stubGlobal("localStorage", {
  getItem: (key: string) => disk.get(key) || null,
  setItem: (key: string, value: string) => {
    if (failWrites) throw new Error("Storage is full");
    disk.set(key, value);
  },
  removeItem: (key: string) => disk.delete(key),
});
beforeEach(async () => {
  disk.clear();
  failWrites = false;
  await hydrate("guest");
});
describe("durable guest data and offline operation transactions", () => {
  it("persists guest tracking without a cloud outbox", async () => {
    await saveSubscription(subscription());
    await hydrate("guest");
    expect(useApp.getState().data.subscriptions).toHaveLength(1);
    expect(useApp.getState().data.outbox).toHaveLength(0);
  });
  it("restores subscriptions and queued edits together after restart", async () => {
    await hydrate(userA);
    await saveSubscription(subscription());
    await saveSubscription({
      ...useApp.getState().data.subscriptions[0]!,
      amountMinor: 1299,
    });
    await hydrate(userA);
    const data = useApp.getState().data;
    expect(data.subscriptions[0]?.version).toBe(2);
    expect(data.outbox.map((op) => op.expectedVersion)).toEqual([null, 1]);
  });
  it("serializes concurrent writes without losing subscriptions", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        saveSubscription(subscription({ id: randomUUID() })),
      ),
    );
    expect(useApp.getState().data.subscriptions).toHaveLength(10);
    await hydrate();
    expect(useApp.getState().data.subscriptions).toHaveLength(10);
  });
  it("never reports a failed disk write as a saved subscription", async () => {
    failWrites = true;
    await expect(saveSubscription(subscription())).rejects.toThrow(
      "Storage is full",
    );
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
  });
  it("preserves guest data during account switching and explicit migration", async () => {
    await saveSubscription(subscription());
    await hydrate(userA);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
    await importGuestData();
    expect(useApp.getState().data.subscriptions).toHaveLength(1);
    expect(useApp.getState().data.outbox).toHaveLength(1);
    await hydrate("guest");
    expect(useApp.getState().data.subscriptions).toHaveLength(1);
  });
  it("isolates cached account identities", async () => {
    await hydrate(userA);
    await saveSubscription(subscription());
    await hydrate(userB);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
    await hydrate(userA);
    expect(useApp.getState().data.subscriptions).toHaveLength(1);
  });
  it("never migrates demonstration prices into an account", async () => {
    await finishOnboarding(defaultPreferences(), true);
    await hydrate(userA);
    await expect(importGuestData()).rejects.toThrow(/sample/);
  });
  it("leaves detections pending until explicit confirmation", async () => {
    const c = extractReceipt(
      "Spotify subscription USD 10.99 monthly\nNext renewal: 2026-11-01",
      randomUUID(),
    );
    await addCandidate(c);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
    await saveSubscription(subscription(), c.id);
    expect(useApp.getState().data.candidates[0]?.state).toBe("confirmed");
    expect(useApp.getState().data.candidates[0]?.matchedSubscriptionId).toBe(
      subscription().id,
    );
  });
  it("commits candidate confirmation and subscription creation in one queued operation", async () => {
    await hydrate(userA);
    const c = extractReceipt(
      "Spotify subscription USD 10.99 monthly\nNext renewal: 2026-11-01",
      randomUUID(),
    );
    await addCandidate(c);
    await saveSubscription(subscription(), c.id);
    const data = useApp.getState().data;
    expect(data.outbox.at(-1)?.entity).toBe("confirmation");
    expect(data.candidates[0]?.state).toBe("confirmed");
    await expect(
      saveSubscription(subscription({ id: randomUUID() }), c.id),
    ).rejects.toThrow(/already been reviewed/);
    expect(data.subscriptions).toHaveLength(1);
  });
  it("does not duplicate receipt imports", async () => {
    const c = extractReceipt(
      "Spotify subscription USD 10.99 monthly",
      randomUUID(),
    );
    await addCandidate(c);
    expect(await addCandidate({ ...c, id: randomUUID() })).toBe(c.id);
    expect(useApp.getState().data.candidates).toHaveLength(1);
  });
  it("records dismissal without creating a subscription", async () => {
    const c = extractReceipt("A one-time purchase USD 40", randomUUID());
    await addCandidate(c);
    await dismissCandidate(c.id);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
    expect(useApp.getState().data.candidates[0]?.state).toBe("dismissed");
  });
  it("records status transitions and deletion in activity", async () => {
    await saveSubscription(subscription());
    await changeStatus(subscription().id, "paused");
    expect(useApp.getState().data.activity[0]?.type).toBe("paused");
    await changeStatus(subscription().id, "canceled", "2026-12-01");
    expect(useApp.getState().data.activity[0]?.type).toBe("canceled");
    await deleteSubscription(subscription().id);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
  });
  it("persists settings in the same authoritative snapshot", async () => {
    await commit((data) => ({
      ...data,
      preferences: { ...data.preferences, appearance: "dark" },
    }));
    await hydrate();
    expect(useApp.getState().data.preferences.appearance).toBe("dark");
  });
});
