import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { accountClient } from "../../src/services/supabase";
import { readSetting, writeSetting } from "../../src/services/featureSettings";
import {
  buildBillingMethod,
  billingReference,
} from "../../src/domain/billingMethods";
import {
  emptyPaymentProfile,
  paymentProfileSchema,
} from "../../src/domain/payments";
import { hydrate, saveSubscription, useApp } from "../../src/store/app";
import { importGuestBillingWorkspace } from "../../src/services/guestBillingImport";
import { subscription, userA, userB } from "../fixtures";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-crypto", () => ({ randomUUID }));
vi.mock("../../src/services/supabase", () => ({ accountClient: vi.fn() }));
const disk = new Map<string, string>();
let failWrites = false;
vi.stubGlobal("localStorage", {
  getItem: (key: string) => disk.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (failWrites) throw new Error("Storage is full");
    disk.set(key, value);
  },
  removeItem: (key: string) => disk.delete(key),
});
const method = buildBillingMethod(
  {
    kind: "card",
    cardBrand: "Visa",
    walletProvider: "PayPal",
    last4: "0042",
    nickname: "Everyday",
  },
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "2026-10-19T20:00:00Z",
);
const profile = { sources: [method], links: [] };
beforeEach(async () => {
  disk.clear();
  failWrites = false;
  vi.mocked(accountClient).mockReset();
  await hydrate("guest");
});
describe("billing metadata persistence and explicit guest import", () => {
  it("round-trips guest card metadata and keeps the last saved profile after disk failure", async () => {
    await writeSetting(
      "guest",
      "payment_sources",
      paymentProfileSchema,
      profile,
      0,
    );
    expect(
      (
        await readSetting(
          "guest",
          "payment_sources",
          paymentProfileSchema,
          emptyPaymentProfile,
        )
      ).value,
    ).toEqual(profile);
    failWrites = true;
    await expect(
      writeSetting(
        "guest",
        "payment_sources",
        paymentProfileSchema,
        emptyPaymentProfile,
        0,
      ),
    ).rejects.toThrow(/Storage is full/);
    expect(
      (
        await readSetting(
          "guest",
          "payment_sources",
          paymentProfileSchema,
          emptyPaymentProfile,
        )
      ).value,
    ).toEqual(profile);
    expect(accountClient).not.toHaveBeenCalled();
  });
  it("copies metadata before subscriptions, preserves guest data, and deduplicates safe retries", async () => {
    await writeSetting(
      "guest",
      "payment_sources",
      paymentProfileSchema,
      profile,
      0,
    );
    await saveSubscription(
      subscription({ paymentMethod: billingReference(method.id) }),
    );
    await hydrate(userA);
    let saved: unknown = null,
      version = 0;
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: saved ? { data: saved, version } : null,
        error: null,
      }),
    };
    const rpc = vi.fn(async (_name, args) => {
      expect(args.expected_version).toBe(version);
      saved = args.setting_data;
      return { data: ++version, error: null };
    });
    vi.mocked(accountClient).mockResolvedValue({
      from: () => query,
      rpc,
    } as unknown as Awaited<ReturnType<typeof accountClient>>);
    await importGuestBillingWorkspace();
    expect(saved).toEqual(profile);
    expect(useApp.getState().data.subscriptions[0]?.paymentMethod).toBe(
      billingReference(method.id),
    );
    expect(useApp.getState().data.outbox).toHaveLength(1);
    await importGuestBillingWorkspace();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useApp.getState().data.subscriptions).toHaveLength(1);
    await hydrate("guest");
    expect(useApp.getState().data.subscriptions).toHaveLength(1);
    expect(
      (
        await readSetting(
          "guest",
          "payment_sources",
          paymentProfileSchema,
          emptyPaymentProfile,
        )
      ).value,
    ).toEqual(profile);
  });
  it("does not import subscriptions when their billing metadata fails to save", async () => {
    await writeSetting(
      "guest",
      "payment_sources",
      paymentProfileSchema,
      profile,
      0,
    );
    await saveSubscription(
      subscription({ paymentMethod: billingReference(method.id) }),
    );
    await hydrate(userA);
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    vi.mocked(accountClient).mockResolvedValue({
      from: () => query,
      rpc: async () => ({ data: null, error: new Error("conflict") }),
    } as unknown as Awaited<ReturnType<typeof accountClient>>);
    await expect(importGuestBillingWorkspace()).rejects.toThrow(
      /Could not save/,
    );
    expect(useApp.getState().data.subscriptions).toEqual([]);
    expect(useApp.getState().data.outbox).toEqual([]);
  });
  it("stops before copying metadata into a different account after an identity change", async () => {
    await writeSetting(
      "guest",
      "payment_sources",
      paymentProfileSchema,
      profile,
      0,
    );
    await saveSubscription(
      subscription({ paymentMethod: billingReference(method.id) }),
    );
    await hydrate(userA);
    const rpc = vi.fn();
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => {
        await hydrate(userB);
        return { data: null, error: null };
      },
    };
    vi.mocked(accountClient).mockResolvedValue({
      from: () => query,
      rpc,
    } as unknown as Awaited<ReturnType<typeof accountClient>>);
    await expect(importGuestBillingWorkspace()).rejects.toThrow(
      /account changed/,
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(useApp.getState().data.subscriptions).toEqual([]);
  });
});
