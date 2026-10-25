import { z } from "zod";
import { currencies, dateSchema } from "../../../src/domain/models.ts";
export function providerRatesUrl(now = new Date()) {
  // Some central banks publish tomorrow's local date before UTC has rolled over.
  // Bound the observation date rather than weakening the future-date validation.
  return `https://api.frankfurter.dev/v2/rates?base=USD&quotes=${currencies.filter((currency) => currency !== "USD").join(",")}&date=${now.toISOString().slice(0, 10)}`;
}
export function parseProviderRates(input: unknown, now = new Date()) {
  const schema = z
    .array(
      z.object({
        date: dateSchema,
        base: z.literal("USD"),
        quote: z.enum(currencies),
        rate: z.number().positive().finite().max(1_000_000),
      }),
    )
    .min(1)
    .max(currencies.length);
  const rates = schema.parse(input),
    today = now.toISOString().slice(0, 10);
  if (new Set(rates.map((r) => r.quote)).size !== rates.length)
    throw new Error("Duplicate exchange rate.");
  if (
    rates.some(
      (r) =>
        r.date > today ||
        now.getTime() - Date.parse(r.date + "T00:00:00Z") > 14 * 86400000 ||
        Number(r.rate.toFixed(12)) === 0,
    )
  )
    throw new Error("Invalid exchange-rate date or precision.");
  // Require complete coverage before replacing any cached observation.
  if (currencies.some((c) => c !== "USD" && !rates.some((r) => r.quote === c)))
    throw new Error("Incomplete exchange-rate response.");
  return rates
    .filter((r) => r.quote !== "USD")
    .map((r) => ({
      base_currency: "USD",
      quote_currency: r.quote,
      rate: r.rate.toFixed(12),
      as_of: r.date,
      fetched_at: now.toISOString(),
      provider: "frankfurter",
    }));
}
