import { it, expect } from "vitest";
import {
  costPerUse,
  offerComparison,
  rotationPlan,
  coachSchema,
} from "../../src/domain/valueCoach";
import { subscription, userA } from "../fixtures";
it("reports undefined cost per zero uses and exact minor-unit estimates", () => {
  const c = {
    subscriptionId: subscription().id,
    month: "2026-10",
    uses: 3,
    goal: "review" as const,
  };
  expect(
    costPerUse(subscription({ amountMinor: 1000, currency: "TND" }), c, [])
      .perUseMinor,
  ).toBe(333);
  expect(
    costPerUse(subscription(), { ...c, uses: 0 }, []).perUseMinor,
  ).toBeNull();
  expect(
    costPerUse(subscription({ status: "paused" }), c, []).totalMinor,
  ).toBeNull();
});
it("compares supplied quotes without inventing an annual discount", () => {
  const q = {
    subscriptionId: userA,
    currency: "EUR" as const,
    monthlyMinor: 1000,
    annualMinor: 10000,
    reference: "Provider quote",
    confirmedDate: "2026-10-12",
  };
  expect(offerComparison(q)).toEqual({
    annualSavingMinor: 2000,
    breakEvenMonths: 10,
  });
  expect(offerComparison({ ...q, monthlyMinor: 0 }).breakEvenMonths).toBeNull();
});
it("requires comparable monthly services for rotations and keeps currencies separate", () => {
  const a = subscription({ amountMinor: 1000 }),
    b = subscription({ id: userA, amountMinor: 2000 });
  const plan = rotationPlan([a, b], [a.id, b.id], "2026-10")!;
  expect(plan.savingMinor).toBe(18000);
  expect(plan.schedule[3]?.month).toBe("2027-01");
  expect(
    rotationPlan([a, { ...b, currency: "EUR" }], [a.id, b.id], "2026-10"),
  ).toBeNull();
  expect(
    rotationPlan([a, { ...b, interval: "yearly" }], [a.id, b.id], "2026-10"),
  ).toBeNull();
});
it("rejects impossible months and duplicate check-ins", () => {
  const c = { subscriptionId: userA, month: "2026-13", uses: 1, goal: "keep" };
  expect(coachSchema.safeParse({ checkins: [c], quotes: [] }).success).toBe(
    false,
  );
  expect(
    coachSchema.safeParse({
      checkins: [
        { ...c, month: "2026-10" },
        { ...c, month: "2026-10" },
      ],
      quotes: [],
    }).success,
  ).toBe(false);
});

it("uses only same-currency confirmed imported net charges for cost per use", () => {
  const s = subscription({ amountMinor: 2000 });
  const checkin = {
    subscriptionId: s.id,
    month: "2026-10",
    uses: 4,
    goal: "review" as const,
  };
  const t = {
    id: userA,
    fingerprint: "a".repeat(64),
    date: "2026-10-12",
    merchant: s.name,
    amountMinor: 1000,
    currency: "USD" as const,
    direction: "debit" as const,
    sourceId: null,
    reference: "QA",
    subscriptionId: s.id,
    ignored: false,
    importedAt: "2026-10-12T00:00:00Z",
  };
  const result = costPerUse(s, checkin, [
    t,
    { ...t, amountMinor: 200, direction: "credit" },
    { ...t, currency: "EUR" },
    { ...t, ignored: true, amountMinor: 9000 },
  ]);
  expect(result.totalMinor).toBe(800);
  expect(result.perUseMinor).toBe(200);
  expect(result.basis).toBe("Matched imported net charges");
});
