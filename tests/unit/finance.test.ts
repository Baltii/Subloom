import { describe, it, expect } from "vitest";
import {
  financeSchema,
  transactionTotals,
  walletSchema,
  transactionSchema,
} from "../../src/domain/finance";
const wallet = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Daily card",
  kind: "card",
  lastFour: "1234",
  archived: false,
};
const transaction = {
  id: "22222222-2222-4222-8222-222222222222",
  merchant: "Music",
  amountMinor: 999,
  currency: "USD",
  date: "2026-10-14",
  kind: "charge",
  status: "settled",
  walletId: wallet.id,
  subscriptionId: null,
  source: "manual",
  createdAt: "2026-10-14T10:00:00Z",
};
describe("financial tracking invariants", () => {
  it("rejects sensitive fields, full card labels and invalid dates", () => {
    expect(
      walletSchema.safeParse({ ...wallet, number: "4242424242424242" }).success,
    ).toBe(false);
    expect(
      walletSchema.safeParse({ ...wallet, name: "4242 4242 4242 4242" })
        .success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({ ...transaction, date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({ ...transaction, source: "provider" })
        .success,
    ).toBe(false);
  });
  it("rejects duplicate records and orphan wallet links", () => {
    expect(
      financeSchema.safeParse({ wallets: [wallet, wallet], transactions: [] })
        .success,
    ).toBe(false);
    expect(
      financeSchema.safeParse({ wallets: [], transactions: [transaction] })
        .success,
    ).toBe(false);
  });
  it("keeps currencies separate and excludes failed and pending entries", () => {
    const input = transactionSchema.parse(transaction);
    expect(
      transactionTotals([
        input,
        { ...input, kind: "refund", amountMinor: 200 },
        { ...input, currency: "JPY", amountMinor: 1000 },
        { ...input, status: "pending" },
        { ...input, status: "failed" },
      ]),
    ).toEqual([
      { currency: "USD", charges: 999, refunds: 200, net: 799 },
      { currency: "JPY", charges: 1000, refunds: 0, net: 1000 },
    ]);
  });
});
