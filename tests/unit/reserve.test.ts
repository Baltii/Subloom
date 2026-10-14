import { it, expect } from "vitest";
import { reservePlan } from "../../src/domain/reserve";
import { ratioMinor } from "../../src/domain/money";
import { subscription } from "../fixtures";
it("keeps currencies separate and excludes access-only and paused events", () => {
  const s = subscription({
    interval: "yearly",
    amountMinor: 12000,
    nextRenewal: "2026-10-20",
    anchorDay: 20,
  });
  const result = reservePlan(
    [
      s,
      { ...s, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", currency: "EUR" },
      {
        ...s,
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "canceled",
        paidThrough: "2026-10-20",
      },
    ],
    {
      payday: "2026-11-01",
      buckets: [{ currency: "USD", plannedMinor: 3000 }],
    },
    "2026-10-12",
  );
  expect(result.monthly.map((t) => t.monthly)).toEqual([1000, 1000]);
  expect(result.funding.find((f) => f.currency === "USD")?.gapMinor).toBe(9000);
  expect(result.charges).toHaveLength(2);
});
it("keeps month-end anchors and excludes payday itself", () => {
  const result = reservePlan(
    [subscription({ nextRenewal: "2026-01-31" })],
    { payday: "2026-03-01", buckets: [] },
    "2026-02-01",
  );
  expect(result.charges[0]?.date).toBe("2026-02-28");
  expect(() =>
    reservePlan([], { payday: "2026-01-01", buckets: [] }, "2026-10-12"),
  ).toThrow();
});
it("scales minor units exactly for zero- and three-decimal currencies", () => {
  expect(ratioMinor(1001, 1, 3)).toBe(334);
  expect(ratioMinor(1000, 1, 3, "up")).toBe(334);
  expect(() => ratioMinor(1, 1, 0)).toThrow();
});

it("includes annual-equivalent custom month renewals in reserve estimates", () => {
  const s = subscription({
    interval: "custom",
    customUnit: "month",
    intervalCount: 12,
    amountMinor: 12000,
    nextRenewal: "2026-10-20",
    anchorDay: 20,
  });
  const result = reservePlan(
    [s],
    { payday: "2026-11-01", buckets: [] },
    "2026-10-12",
  );
  expect(result.monthly[0]?.monthly).toBe(1000);
  expect(result.rows).toHaveLength(1);
});
