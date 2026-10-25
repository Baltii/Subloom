import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  hydrate,
  saveSubscription,
  importSubscriptions,
  importGuestData,
  deleteSubscription,
  useApp,
} from "../../src/store/app";
import { emptyPro, usePro } from "../../src/store/pro";
import { writeSetting, readSetting } from "../../src/services/featureSettings";
import {
  paymentProfileSchema,
  emptyPaymentProfile,
} from "../../src/domain/payments";
import { buildBillingMethod } from "../../src/domain/billingMethods";
import { subscription, userA } from "../fixtures";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-crypto", () => ({ randomUUID }));
vi.mock("../../src/services/supabase", () => ({ accountClient: vi.fn() }));
const disk = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => disk.set(key, value),
  removeItem: (key: string) => disk.delete(key),
});
const rows = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    subscription({ id: randomUUID(), name: "Tracked service " + i }),
  );
function enablePro() {
  usePro.setState({
    ...emptyPro,
    workspace: "guest",
    owner: userA,
    ready: true,
    offlineUntil: Date.now() + 60000,
  });
}
beforeEach(async () => {
  disk.clear();
  usePro.setState(emptyPro);
  await hydrate("guest");
});

describe("durable free plan limits", () => {
  it("allows ten subscriptions and serializes competing additions at the limit", async () => {
    for (const input of rows(9)) await saveSubscription(input);
    const results = await Promise.allSettled(
      rows(2).map((s) => saveSubscription(s)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await hydrate("guest");
    expect(useApp.getState().data.subscriptions).toHaveLength(10);
  });
  it("rejects Free CSV imports atomically and allows Pro imports with duplicate rows skipped", async () => {
    const inputs = rows(11);
    await expect(importSubscriptions(inputs, "guest")).rejects.toThrow(/Pro/);
    expect(useApp.getState().data.subscriptions).toHaveLength(0);
    expect(useApp.getState().data.activity).toHaveLength(0);
    enablePro();
    await importSubscriptions(inputs, "guest");
    await importSubscriptions(inputs, "guest");
    expect(useApp.getState().data.subscriptions).toHaveLength(11);
    usePro.setState({ offlineUntil: Date.now() - 1 });
    await expect(importSubscriptions(rows(1), "guest")).rejects.toThrow(/Pro/);
    expect(useApp.getState().data.subscriptions).toHaveLength(11);
  });
  it("preserves over-limit Pro records after expiry and permits editing and deletion", async () => {
    enablePro();
    await importSubscriptions(rows(11), "guest");
    usePro.setState({ offlineUntil: Date.now() - 1 });
    const first = useApp.getState().data.subscriptions[0]!;
    await saveSubscription({ ...first, notes: "Still editable" });
    await expect(saveSubscription(rows(1)[0]!)).rejects.toThrow(
      /10 subscriptions/,
    );
    await deleteSubscription(first.id);
    await expect(saveSubscription(rows(1)[0]!)).rejects.toThrow(
      /10 subscriptions/,
    );
    await deleteSubscription(useApp.getState().data.subscriptions[0]!.id);
    await saveSubscription(rows(1)[0]!);
    expect(useApp.getState().data.subscriptions).toHaveLength(10);
  });
  it("does not partially merge a guest workspace that would exceed account capacity", async () => {
    for (const input of rows(2)) await saveSubscription(input);
    await hydrate(userA);
    for (const input of rows(9)) await saveSubscription(input);
    const before = useApp.getState().data;
    await expect(importGuestData()).rejects.toThrow(/10 subscriptions/);
    expect(useApp.getState().data).toBe(before);
  });
  it("enforces separate card/wallet capacity on local writes and keeps edits after downgrade", async () => {
    const method = (kind: "card" | "wallet") =>
      buildBillingMethod(
        {
          kind,
          cardBrand: "Visa",
          walletProvider: "PayPal",
          last4: "0042",
          nickname: "",
        },
        randomUUID(),
        new Date().toISOString(),
      );
    const card = method("card"),
      wallet = method("wallet"),
      extra = method("card");
    const save = (sources: (typeof card)[]) =>
      writeSetting(
        "guest",
        "payment_sources",
        paymentProfileSchema,
        { sources, links: [] },
        0,
      );
    await save([card, wallet]);
    await expect(save([card, extra])).rejects.toThrow(/Pro/);
    await expect(save([wallet, method("wallet")])).rejects.toThrow(/Pro/);
    enablePro();
    await save([card, wallet, extra]);
    usePro.setState(emptyPro);
    await save([{ ...card, name: "Renamed" }, wallet, extra]);
    await expect(save([card, wallet, extra, method("card")])).rejects.toThrow(
      /Pro/,
    );
    const stored = await readSetting(
      "guest",
      "payment_sources",
      paymentProfileSchema,
      emptyPaymentProfile,
    );
    expect(stored.value.sources[0]?.name).toBe("Renamed");
    await save([card, wallet]);
  });
});
