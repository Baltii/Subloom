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
