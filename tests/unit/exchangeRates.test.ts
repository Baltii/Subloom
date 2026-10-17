import { describe, expect, it } from "vitest";
import {
  convertMinor,
  type ExchangeRate,
} from "../../src/domain/exchangeRates";
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
});
