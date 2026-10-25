import type { Currency } from "./models";
import { convertMinor, type ExchangeRate } from "./exchangeRates";
import { formatMoney } from "./money";

/** Read-only presentation; never use converted values for edits, matching or exports. */
export function currencyDisplay(currency: Currency, rates: ExchangeRate[]) {
  const convert = (amount: number, from: Currency): number | null => {
    if (amount === 0) return 0;
    try {
      const value = convertMinor(Math.abs(amount), from, currency, rates);
      return amount < 0 ? -value : value;
    } catch {
      return null;
    }
  };
  const format = (
    amount: number,
    from: Currency = currency,
    withCode = false,
  ) => {
    const value = convert(amount, from);
    return value === null
      ? "Rate unavailable"
      : formatMoney(value, currency) + (withCode ? ` ${currency}` : "");
  };
  const total = (
    amounts: readonly { amountMinor: number; currency: Currency }[],
  ) => {
    let sum = 0;
    for (const amount of amounts) {
      const value = convert(amount.amountMinor, amount.currency);
      if (value === null) return null;
      sum += value;
      if (!Number.isSafeInteger(sum)) return null;
    }
    return sum;
  };
  return { currency, convert, format, total };
}
