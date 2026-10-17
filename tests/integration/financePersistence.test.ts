import { afterEach, expect, it, vi } from "vitest";
import {
  readSetting,
  writeSetting,
  clearLocalFeatures,
} from "../../src/services/featureSettings";
import {
  financeSchema,
  initialFinance,
  transactionTotals,
} from "../../src/domain/finance";
import { accountClient } from "../../src/services/supabase";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../../src/services/supabase", () => ({ accountClient: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("persists guest finances durably and includes them in guest reset", async () => {
  const values: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
    removeItem: (key: string) => {
      delete values[key];
    },
  };
  // Browser Storage exposes keys for Object.keys, as the reset implementation expects.
  vi.stubGlobal(
    "localStorage",
    new Proxy(storage, {
      ownKeys: () => Object.keys(values),
      getOwnPropertyDescriptor: () => ({
        enumerable: true,
        configurable: true,
      }),
    }),
  );
  const data = {
    wallets: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Daily",
        kind: "card" as const,
        lastFour: "1234",
        archived: false,
      },
    ],
    transactions: [],
  };
  await writeSetting("guest", "finance", financeSchema, data, 0);
  expect(
    (await readSetting("guest", "finance", financeSchema, initialFinance))
      .value,
  ).toEqual(data);
  expect(accountClient).not.toHaveBeenCalled();
  await clearLocalFeatures("guest");
  expect(
    (await readSetting("guest", "finance", financeSchema, initialFinance))
      .value,
  ).toEqual(initialFinance);
});
it("fails visibly if guest durable storage rejects a write", async () => {
  vi.stubGlobal("localStorage", {
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  });
  await expect(
    writeSetting("guest", "finance", financeSchema, initialFinance, 0),
  ).rejects.toThrow(/Storage unavailable/);
});
it("binds account updates to their owner and expected version and rejects conflicts", async () => {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "conflict" } }),
  };
  const from = vi.fn(() => query);
  vi.mocked(accountClient).mockResolvedValue({ from } as unknown as Awaited<
    ReturnType<typeof accountClient>
  >);
  await expect(
    writeSetting("account-a", "finance", financeSchema, initialFinance, 4),
  ).rejects.toThrow(/reload/);
  expect(accountClient).toHaveBeenCalledWith("account-a");
  expect(query.eq).toHaveBeenCalledWith("user_id", "account-a");
  expect(query.eq).toHaveBeenCalledWith("version", 4);
  expect(query.update).toHaveBeenCalledWith({
    data: initialFinance,
    version: 5,
  });
});

it("persists corrected and removed entries without counting pending charges or mixing currencies", async () => {
  const records = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
  });
  const transaction = {
    id: "11111111-1111-4111-8111-111111111111",
    merchant: "Fixture",
    amountMinor: 12345,
    currency: "TND" as const,
    date: "2026-10-17",
    kind: "charge" as const,
    status: "pending" as const,
    walletId: null,
    subscriptionId: null,
    source: "manual" as const,
    createdAt: "2026-10-17T00:00:00.000Z",
  };
  await writeSetting(
    "guest",
    "finance",
    financeSchema,
    { wallets: [], transactions: [transaction] },
    0,
  );
  let saved = (
    await readSetting("guest", "finance", financeSchema, initialFinance)
  ).value;
  expect(transactionTotals(saved.transactions)).toEqual([]);
  await writeSetting(
    "guest",
    "finance",
    financeSchema,
    {
      ...saved,
      transactions: [{ ...transaction, amountMinor: 9876, status: "settled" }],
    },
    0,
  );
  saved = (await readSetting("guest", "finance", financeSchema, initialFinance))
    .value;
  expect(saved.transactions).toHaveLength(1);
  expect(transactionTotals(saved.transactions)).toEqual([
    { currency: "TND", charges: 9876, refunds: 0, net: 9876 },
  ]);
  await writeSetting(
    "guest",
    "finance",
    financeSchema,
    { ...saved, transactions: [] },
    0,
  );
  saved = (await readSetting("guest", "finance", financeSchema, initialFinance))
    .value;
  expect(saved.transactions).toEqual([]);
  expect(transactionTotals(saved.transactions)).toEqual([]);
});
