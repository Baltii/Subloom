import { it, expect } from "vitest";
import {
  settlementBalances,
  type LedgerEntry,
} from "../../src/domain/settlements";
import { userA, userB } from "../fixtures";
const charge: LedgerEntry = {
  id: userA,
  workspace_id: userA,
  recorded_by: userA,
  kind: "charge",
  payer: userA,
  payee: null,
  currency: "EUR",
  amount_minor: 1001,
  event_date: "2026-10-12",
  subscription_id: userA,
  shares: [
    { userId: userA, amountMinor: 501 },
    { userId: userB, amountMinor: 500 },
  ],
  note: "Receipt",
  due_date: null,
  voided: false,
  version: 1,
  created_at: "2026-10-12T00:00:00Z",
};
it("creates debt only from paid snapshots and nets partial settlements by currency", () => {
  const settlement = {
    ...charge,
    id: userB,
    kind: "settlement" as const,
    payer: userB,
    payee: userA,
    shares: [],
    amount_minor: 200,
    subscription_id: null,
  };
  expect(settlementBalances([charge, settlement])).toEqual([
    {
      workspaceId: userA,
      debtor: userB,
      creditor: userA,
      currency: "EUR",
      amountMinor: 300,
    },
  ]);
  expect(
    settlementBalances([charge, { ...settlement, currency: "GBP" }]),
  ).toHaveLength(2);
  expect(settlementBalances([{ ...charge, voided: true }])).toEqual([]);
  expect(settlementBalances([{ ...settlement, kind: "request" }])).toEqual([]);
});
it("keeps workspace balances separate and displays overpayment credit honestly", () => {
  const settlement = {
    ...charge,
    kind: "settlement" as const,
    payer: userB,
    payee: userA,
    shares: [],
    amount_minor: 600,
    subscription_id: null,
  };
  expect(settlementBalances([charge, settlement])[0]).toMatchObject({
    debtor: userA,
    creditor: userB,
    amountMinor: 100,
  });
  expect(
    settlementBalances([charge, { ...charge, workspace_id: userB }]),
  ).toHaveLength(2);
});
