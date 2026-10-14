import { it, expect } from "vitest";
import { evaluateRule, type AutopilotRule } from "../../src/domain/autopilot";
import { subscription, userA } from "../fixtures";
const rule: AutopilotRule = {
  subscriptionId: subscription().id,
  askAnnual: true,
  warnIncrease: true,
  baselineMinor: 1000,
  currency: "USD",
  limitMinor: 1200,
  leadDays: 7,
  revision: userA,
  baselineDate: "2026-01-01",
  decision: null,
};
it("asks before annual renewals and applies a same-currency ceiling", () => {
  const row = evaluateRule(
    subscription({
      interval: "yearly",
      amountMinor: 1300,
      nextRenewal: "2026-10-15",
    }),
    rule,
    "2026-10-12",
    [],
  )!;
  expect(row.due).toBe(true);
  expect(row.limitExceeded).toBe(true);
  expect(row.reasons).toHaveLength(3);
});
it("invalidates decisions when the date, price, currency or rule changes", () => {
  const s = subscription({ nextRenewal: "2026-10-15" });
  const row = evaluateRule(s, rule, "2026-10-12", [])!;
  const reviewed = {
    ...rule,
    decision: {
      key: row.key,
      outcome: "reviewed" as const,
      reference: "",
      recordedAt: "2026-10-12T00:00:00Z",
    },
  };
  expect(evaluateRule(s, reviewed, "2026-10-12", [])!.reviewed).toBe(true);
  for (const changed of [
    { ...s, amountMinor: 1201 },
    { ...s, currency: "EUR" as const },
    { ...s, nextRenewal: "2026-11-15" },
  ])
    expect(evaluateRule(changed, reviewed, "2026-10-12", [])!.reviewed).toBe(
      false,
    );
  expect(
    evaluateRule({ ...s, currency: "EUR" }, reviewed, "2026-10-12", [])!
      .limitExceeded,
  ).toBe(false);
});
it("does not treat canceled access as a renewal", () => {
  expect(
    evaluateRule(
      subscription({ status: "canceled", paidThrough: "2026-11-01" }),
      rule,
      "2026-10-12",
      [],
    ),
  ).toBeNull();
});

it("recognizes equivalent annual month and quarter cadences", () => {
  for (const cadence of [
    { interval: "monthly" as const, intervalCount: 12 },
    {
      interval: "custom" as const,
      customUnit: "month" as const,
      intervalCount: 12,
    },
    { interval: "quarterly" as const, intervalCount: 4 },
  ]) {
    expect(
      evaluateRule(
        subscription({
          ...cadence,
          amountMinor: 1000,
          nextRenewal: "2026-10-15",
          anchorDay: 15,
        }),
        rule,
        "2026-10-12",
        [],
      )!.reasons,
    ).toContain("Annual renewal needs your review");
  }
});
