import { describe, expect, it } from "vitest";
import {
  annualCost,
  currencyDigits,
  formatMoney,
  moneyInput,
  parseMoney,
  recurringTotals,
} from "../../src/domain/money";
import { subscription } from "../fixtures";
describe("minor-unit money", () => {
  it.each([
    ["10.99", "USD", 1099],
    ["0.01", "EUR", 1],
    ["1.234", "TND", 1234],
    ["1200", "JPY", 1200],
    ["0", "USD", 0],
  ] as const)("parses %s %s exactly", (value, currency, expected) =>
    expect(parseMoney(value, currency)).toBe(expected),
  );
  it.each(["-1", "1e3", "1,000", "NaN", "", "1.0000", "999999999"])(
    "rejects invalid or unsupported amount %s",
    (value) => expect(() => parseMoney(value, "USD")).toThrow(),
  );
  it("rejects fractional yen", () =>
    expect(() => parseMoney("1.5", "JPY")).toThrow());
  it("formats three-decimal dinars and whole yen", () => {
    expect(currencyDigits("TND")).toBe(3);
    expect(moneyInput(1234, "TND")).toBe("1.234");
    expect(formatMoney(1200, "JPY")).toContain("1,200");
  });
  it("adds decimal cents without floating point drift", () => {
    const items = Array.from({ length: 100 }, () =>
      subscription({ amountMinor: 10 }),
    );
    expect(recurringTotals(items)[0]).toMatchObject({
      monthly: 1000,
      annual: 12000,
    });
  });
  it("rounds rational totals once after aggregation", () => {
    const items = Array.from({ length: 12 }, () =>
      subscription({ amountMinor: 1, interval: "yearly" }),
    );
    expect(recurringTotals(items)[0]?.monthly).toBe(1);
  });
  it("keeps currencies separate", () =>
    expect(
      recurringTotals([
        subscription(),
        subscription({ currency: "EUR", amountMinor: 2000 }),
      ]),
    ).toHaveLength(2));
  it("includes future trial cost, excludes canceled and paused", () =>
    expect(
      recurringTotals([
        subscription({ status: "trial" }),
        subscription({ status: "canceled" }),
        subscription({ status: "paused" }),
      ])[0]?.count,
    ).toBe(1));
  it("normalizes weekly and quarterly using documented estimates", () => {
    expect(
      annualCost(subscription({ amountMinor: 700, interval: "weekly" })),
    ).toBe(36500);
    expect(
      annualCost(subscription({ amountMinor: 3000, interval: "quarterly" })),
    ).toBe(12000);
  });
  it("supports custom days and interval counts", () => {
    expect(
      annualCost(
        subscription({
          amountMinor: 100,
          interval: "custom",
          customUnit: "day",
          intervalCount: 5,
        }),
      ),
    ).toBe(7300);
    expect(
      annualCost(
        subscription({
          amountMinor: 2000,
          interval: "monthly",
          intervalCount: 2,
        }),
      ),
    ).toBe(12000);
  });
});
