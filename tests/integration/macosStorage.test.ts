import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadSnapshot,
  removeSnapshot,
  saveSnapshot,
} from "../../src/services/storage";
import { emptySnapshot } from "../../src/domain/models";
import { subscription, userA, userB } from "../fixtures";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
const native = new Map<string, string>();
const legacy = new Map<string, string>();
let fail = false;
const request = vi.fn(
  async ({
    op,
    identity,
    value,
  }: {
    op: string;
    identity: string;
    value?: string;
  }) => {
    if (fail) throw new Error("Disk unavailable");
    if (op === "snapshot.read") return native.get(identity) ?? null;
    if (op === "snapshot.write") native.set(identity, value!);
    if (op === "snapshot.remove") native.delete(identity);
    return true;
  },
);
beforeEach(() => {
  native.clear();
  legacy.clear();
  fail = false;
  request.mockClear();
  vi.stubGlobal("subloomMac", { version: 1, request });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => legacy.get(key) ?? null,
    removeItem: (key: string) => legacy.delete(key),
  });
});
describe("Mac durable workspace snapshots", () => {
  it("saves all guest fields without depending on WebKit storage", async () => {
    const data = {
      ...emptySnapshot(),
      onboarded: true,
      subscriptions: [subscription()],
    };
    data.preferences.appearance = "dark";
    await saveSnapshot("guest", data);
    expect(await loadSnapshot("guest")).toEqual(data);
    expect(legacy.size).toBe(0);
  });
  it("validates and migrates the old WebKit copy without deleting it", async () => {
    const data = { ...emptySnapshot(), subscriptions: [subscription()] };
    legacy.set("subloom:v1:guest", JSON.stringify(data));
    expect(await loadSnapshot("guest")).toEqual(data);
    expect(native.has("guest")).toBe(true);
    expect(legacy.has("subloom:v1:guest")).toBe(true);
  });
  it("preserves invalid legacy data instead of migrating or overwriting", async () => {
    legacy.set("subloom:v1:guest", '{"schemaVersion":99}');
    await expect(loadSnapshot("guest")).rejects.toThrow(/preserved/);
    expect(native.size).toBe(0);
    expect(legacy.has("subloom:v1:guest")).toBe(true);
  });
  it("does not hide native disk errors behind stale legacy copies", async () => {
    legacy.set("subloom:v1:guest", JSON.stringify(emptySnapshot()));
    fail = true;
    await expect(loadSnapshot("guest")).rejects.toThrow("Disk unavailable");
    await expect(saveSnapshot("guest", emptySnapshot())).rejects.toThrow(
      "Disk unavailable",
    );
  });
  it("keeps guest and account caches isolated and removes only the selected workspace", async () => {
    await saveSnapshot("guest", {
      ...emptySnapshot(),
      subscriptions: [subscription()],
    });
    await saveSnapshot(userA, emptySnapshot());
    await saveSnapshot(userB, emptySnapshot());
    legacy.set("subloom:v1:" + userA, JSON.stringify(emptySnapshot()));
    await removeSnapshot(userA);
    expect(native.has(userA)).toBe(false);
    expect(legacy.has("subloom:v1:" + userA)).toBe(false);
    expect(native.has(userB)).toBe(true);
    expect((await loadSnapshot("guest")).subscriptions).toHaveLength(1);
  });
});
