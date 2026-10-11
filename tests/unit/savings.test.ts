import { it, expect } from "vitest";
import { subscription } from "../fixtures";
import { simulateSavings } from "../../src/domain/savings";
it("keeps currencies separate and ignores inactive, duplicate and stale selections", () => {
  const a = subscription(),
    b = subscription({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      currency: "EUR",
    }),
    c = subscription({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "paused",
    });
  const before = JSON.stringify([a, b, c]);
  const result = simulateSavings([a, b, c], [a.id, a.id, c.id, "missing"]);
  expect(result).toMatchObject({
    count: 1,
    savings: [{ currency: "USD", monthly: 1099, annual: 13188 }],
    remaining: [{ currency: "EUR" }],
  });
  expect(JSON.stringify([a, b, c])).toBe(before);
});
it("starts empty and accounts for yearly costs", () => {
  const a = subscription({ interval: "yearly", amountMinor: 12000 });
  expect(simulateSavings([a], []).savings).toEqual([]);
  expect(simulateSavings([a], [a.id]).savings[0]?.monthly).toBe(1000);
});
