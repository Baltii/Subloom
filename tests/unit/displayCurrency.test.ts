import { expect, it } from "vitest";
import { currencyDisplay } from "../../src/domain/displayCurrency";
import type { ExchangeRate } from "../../src/domain/exchangeRates";
import { monthEvents } from "../../src/domain/calendarEvents";
import { subscription } from "../fixtures";
const rates: ExchangeRate[] = Object.entries({
  GBP: "0.75",
  EUR: "0.90",
  TND: "3",
  JPY: "150",
}).map(([quote, rate]) => ({
  base_currency: "USD",
  quote_currency: quote as ExchangeRate["quote_currency"],
  rate,
  as_of: "2026-10-25",
  fetched_at: "2026-10-25T00:00:00Z",
  provider: "frankfurter",
}));
it("uses the global currency for prices, refunds and price-change amounts", () => {
  const display = currencyDisplay("GBP", rates);
  expect(display.format(2000, "USD", true)).toBe("£15.00 GBP");
  expect(display.format(900, "EUR")).toBe("£7.50");
  expect(display.format(-2000, "USD")).toBe("-£15.00");
  expect(display.format(100, "GBP")).toBe("£1.00");
  expect(display.convert(30000, "TND")).toBe(750);
  expect(currencyDisplay("TND", rates).convert(1500, "JPY")).toBe(30000);
});
it("responds to a currency change without changing stored amounts", () => {
  const original = subscription({ currency: "USD", amountMinor: 2000 });
  expect(
    currencyDisplay("GBP", rates).format(
      original.amountMinor,
      original.currency,
    ),
  ).toBe("£15.00");
  expect(
    currencyDisplay("EUR", rates).format(
      original.amountMinor,
      original.currency,
    ),
  ).toBe("€18.00");
  expect(original).toMatchObject({ currency: "USD", amountMinor: 2000 });
});
it("combines mixed-currency calendar charges, excluding starts and access endings", () => {
  const originals = [
    subscription({
      amountMinor: 100,
      currency: "USD",
      startDate: "2026-10-01",
    }),
    subscription({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      amountMinor: 900,
      currency: "EUR",
    }),
    subscription({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "canceled",
      paidThrough: "2026-10-10",
      amountMinor: 90000,
    }),
  ];
  const before = structuredClone(originals);
  const events = monthEvents(originals, "2026-10-01");
  const charges = events.filter(
    (event) => event.type === "renewal" || event.type === "trial",
  );
  const display = currencyDisplay("GBP", rates);
  expect(display.total(charges.map((event) => event.subscription))).toBe(825);
  expect(originals).toEqual(before);
});
it("never presents partial totals or an unconverted amount as the selected currency", () => {
  const display = currencyDisplay("GBP", rates);
  expect(display.format(100, "SAR")).toBe("Rate unavailable");
  expect(
    display.total([
      { amountMinor: 2000, currency: "USD" },
      { amountMinor: 100, currency: "SAR" },
    ]),
  ).toBeNull();
  expect(display.convert(Number.POSITIVE_INFINITY, "USD")).toBeNull();
  expect(display.total([])).toBe(0);
  expect(currencyDisplay("GBP", []).format(0, "USD")).toBe("£0.00");
});
