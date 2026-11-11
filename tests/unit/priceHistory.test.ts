import { it, expect } from "vitest";
import { subscription } from "../fixtures";
import {
  pricePoint,
  recordPrice,
  priceDifference,
} from "../../src/domain/priceHistory";
it("records actual price changes and labels an old-data baseline", () => {
  const s = subscription(),
    next = { ...s, amountMinor: 1299, version: 2 };
  const rows = recordPrice([], s, next);
  expect(rows).toHaveLength(2);
  expect(rows[0]?.source).toBe("baseline");
  expect(priceDifference(rows[0]!, rows[1]!)).toBe(200);
  expect(
    recordPrice(rows, next, { ...next, notes: "change", version: 3 }),
  ).toBe(rows);
});
it("avoids comparisons across currency or billing terms", () => {
  const a = pricePoint(subscription()),
    b = pricePoint(subscription({ currency: "EUR" }));
  expect(priceDifference(a, b)).toBeNull();
  expect(
    priceDifference(a, pricePoint(subscription({ interval: "yearly" }))),
  ).toBeNull();
});
it("accepts legacy date-only timestamps when a saved price is edited", () => {
  const previous = subscription({ updatedAt: "2026-01-01" });
  const next = {
    ...previous,
    amountMinor: 800,
    version: 2,
    updatedAt: "2026-11-11T12:00:00Z",
  };
  const points = recordPrice([], previous, next);
  expect(points[0]?.capturedAt).toBe("2026-01-01T00:00:00.000Z");
  expect(points[1]?.amountMinor).toBe(800);
});
