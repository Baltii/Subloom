import { z } from "zod";
import {
  currencies,
  dateSchema,
  type Currency,
  type Subscription,
} from "./models.ts";
import { currencyDigits } from "./money.ts";
export const exchangeRateSchema = z.object({
  base_currency: z.literal("USD"),
  quote_currency: z.enum(currencies),
  rate: z
    .string()
    .regex(/^\d+(?:\.\d{1,12})?$/)
    .refine((v) => BigInt(v.replace(".", "")) > 0),
  as_of: dateSchema,
  fetched_at: z.string(),
  provider: z.literal("frankfurter"),
});
export type ExchangeRate = z.infer<typeof exchangeRateSchema>;
function rational(rate: string) {
  const [whole, fraction = ""] = rate.split(".");
  return { n: BigInt(whole! + fraction), d: 10n ** BigInt(fraction.length) };
}
export function convertMinor(
  amount: number,
  from: Currency,
  to: Currency,
  rates: ExchangeRate[],
): number {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Use a valid original amount.");
  if (from === to) return amount;
  const find = (currency: Currency) => {
    if (currency === "USD") return { n: 1n, d: 1n };
    const rate = rates.find((r) => r.quote_currency === currency);
    if (!rate) throw new Error("No cached rate for " + currency + ".");
    return rational(exchangeRateSchema.parse(rate).rate);
  };
  const source = find(from),
    target = find(to);
  const numerator =
    BigInt(amount) * target.n * source.d * 10n ** BigInt(currencyDigits(to));
  const denominator = target.d * source.n * 10n ** BigInt(currencyDigits(from));
  const converted = Number((2n * numerator + denominator) / (2n * denominator));
  if (!Number.isSafeInteger(converted))
    throw new Error("Converted estimate is too large.");
  return converted;
}

/** Display-only copies: stored prices and provider billing are never changed. */
export function convertedSubscriptions(
  subscriptions: Subscription[],
  currency: Currency,
  rates: ExchangeRate[],
) {
  const missing = new Set<Currency>();
  const converted = subscriptions.flatMap((subscription) => {
    try {
      return [
        {
          ...subscription,
          currency,
          amountMinor: convertMinor(
            subscription.amountMinor,
            subscription.currency,
            currency,
            rates,
          ),
        },
      ];
    } catch {
      if (["active", "trial"].includes(subscription.status))
        missing.add(subscription.currency);
      return [];
    }
  });
  return { subscriptions: converted, missing: [...missing] };
}
