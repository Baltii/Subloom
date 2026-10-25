import { describe, expect, it } from "vitest";
import {
  convertMinor,
  convertedSubscriptions,
  type ExchangeRate,
} from "../../src/domain/exchangeRates";
import { subscription } from "../fixtures";
import { recurringTotals } from "../../src/domain/money";
import { categorySpending, renewalForecast } from "../../src/domain/insights";
const rates: ExchangeRate[] = [
  {
    base_currency: "USD",
    quote_currency: "EUR",
    rate: "0.900000000000",
    as_of: "2026-10-14",
    fetched_at: "2026-10-14T17:30:00Z",
    provider: "frankfurter",
  },
  {
    base_currency: "USD",
    quote_currency: "TND",
    rate: "3.000000000000",
    as_of: "2026-10-14",
    fetched_at: "2026-10-14T17:30:00Z",
    provider: "frankfurter",
  },
  {
    base_currency: "USD",
    quote_currency: "JPY",
    rate: "150.000000000000",
    as_of: "2026-10-14",
    fetched_at: "2026-10-14T17:30:00Z",
    provider: "frankfurter",
  },
];
describe("integer currency estimates", () => {
  it("converts across two, three and zero decimal currencies", () => {
    expect(convertMinor(1000, "USD", "TND", rates)).toBe(30000);
    expect(convertMinor(900, "EUR", "JPY", rates)).toBe(1500);
    expect(convertMinor(1500, "JPY", "EUR", rates)).toBe(900);
    expect(convertMinor(30000, "TND", "USD", rates)).toBe(1000);
    expect(convertMinor(1, "USD", "JPY", rates)).toBe(2);
  });
  it("never invents missing rates and preserves originals", () => {
    expect(() => convertMinor(100, "GBP", "USD", rates)).toThrow(/No cached/);
    expect(convertMinor(100, "GBP", "GBP", [])).toBe(100);
    expect(() => convertMinor(-1, "USD", "USD", rates)).toThrow();
  });
  it("combines all currencies for totals, categories and forecasts without changing saved prices", () => {
    const originals = [
      subscription({ currency: "USD", amountMinor: 1000 }),
      subscription({ currency: "EUR", amountMinor: 900 }),
      subscription({
        currency: "JPY",
        amountMinor: 1500,
        status: "trial",
        trialEnd: "2026-10-28",
      }),
      subscription({ currency: "TND", amountMinor: 30000 }),
      subscription({ currency: "GBP", status: "paused" }),
    ];
    const before = structuredClone(originals);
    const result = convertedSubscriptions(originals, "USD", rates);
    expect(result.missing).toEqual([]);
    expect(recurringTotals(result.subscriptions)[0]).toMatchObject({
      monthly: 4000,
      annual: 48000,
      count: 4,
      currency: "USD",
    });
    expect(
      categorySpending(result.subscriptions, "USD").reduce(
        (sum, row) => sum + row.amount,
        0,
      ),
    ).toBe(4000);
    const forecast = renewalForecast(result.subscriptions, "USD", "2026-10-01");
    expect(
      forecast
        .flatMap((month) => month.events)
        .every((event) => event.subscription.currency === "USD"),
    ).toBe(true);
    expect(originals).toEqual(before);
  });
  it("reports missing active currencies so an incomplete total is never presented as complete", () => {
    const result = convertedSubscriptions(
      [
        subscription({ currency: "USD" }),
        subscription({ currency: "SAR" }),
        subscription({ currency: "SAR", status: "trial" }),
        subscription({ currency: "CNY", status: "canceled" }),
      ],
      "USD",
      rates,
    );
    expect(result.missing).toEqual(["SAR"]);
    expect(result.subscriptions).toHaveLength(1);
  });
});
