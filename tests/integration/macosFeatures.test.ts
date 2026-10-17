import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  localSetting,
  clearLocalFeatures,
  removeLocalSetting,
} from "../../src/services/featureSettings";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../../src/services/supabase", () => ({ accountClient: vi.fn() }));
const native = new Map<string, string>();
const legacy: Record<string, string> = {};
let failure = false;
const request = vi.fn(
  async ({
    op,
    identity,
    key,
    value,
  }: {
    op: string;
    identity: string;
    key: string;
    value: string;
  }) => {
    if (failure) throw new Error("Disk unavailable");
    const id = identity + ":" + key;
    if (op === "feature.read") return native.get(id) ?? null;
    if (op === "feature.write") native.set(id, value);
    if (op === "feature.remove") native.delete(id);
    if (op === "feature.clear")
      for (const entry of native.keys())
        if (entry.startsWith(identity + ":")) native.delete(entry);
    return true;
  },
);
beforeEach(() => {
  native.clear();
  for (const key of Object.keys(legacy)) delete legacy[key];
  failure = false;
  request.mockClear();
  vi.stubGlobal("subloomMac", { version: 1, request });
  vi.stubGlobal(
    "localStorage",
    new Proxy(
      {
        getItem: (key: string) => legacy[key] ?? null,
        removeItem: (key: string) => {
          delete legacy[key];
        },
      },
      {
        ownKeys: () => Object.keys(legacy),
        getOwnPropertyDescriptor: () => ({
          enumerable: true,
          configurable: true,
        }),
      },
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("saves all financial feature types in native files and preserves them when WebKit storage is empty", async () => {
  for (const key of [
    "finance",
    "crypto",
    "payment_sources",
    "payment_transactions",
    "autopilot",
    "crypto_history_fixture",
  ])
    await localSetting("guest", key, "[]");
  expect(native.size).toBe(6);
  expect(await localSetting("guest", "finance")).toBe("[]");
  expect(Object.keys(legacy)).toHaveLength(0);
});
it("migrates existing WebKit financial data and preserves the source", async () => {
  legacy["subloom:features:v1:guest:finance"] =
    '{"wallets":[],"transactions":[]}';
  expect(await localSetting("guest", "finance")).toBe(
    legacy["subloom:features:v1:guest:finance"],
  );
  expect(native.get("guest:finance")).toBe(
    legacy["subloom:features:v1:guest:finance"],
  );
});
it("never hides disk failures behind stale WebKit data", async () => {
  legacy["subloom:features:v1:guest:finance"] = "[]";
  failure = true;
  await expect(localSetting("guest", "finance")).rejects.toThrow(
    /Disk unavailable/,
  );
  await expect(localSetting("guest", "finance", "[]")).rejects.toThrow(
    /Disk unavailable/,
  );
});
it("clears native and migration data only for the selected identity", async () => {
  legacy["subloom:features:v1:guest:finance"] = "[]";
  await localSetting("guest", "finance");
  await localSetting("account-a", "finance", "[]");
  await clearLocalFeatures("guest");
  expect(await localSetting("guest", "finance")).toBeNull();
  expect(await localSetting("account-a", "finance")).toBe("[]");
});

it("removes one watched-address history without clearing other features or restoring legacy data", async () => {
  legacy["subloom:features:v1:guest:crypto_history_fixture"] = "[]";
  await localSetting("guest", "crypto_history_fixture");
  await localSetting("guest", "finance", "{}");
  await removeLocalSetting("guest", "crypto_history_fixture");
  expect(await localSetting("guest", "crypto_history_fixture")).toBeNull();
  expect(await localSetting("guest", "finance")).toBe("{}");
});
