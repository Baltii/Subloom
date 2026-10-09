import type { Currency, Subscription } from "./models.ts";

export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}
export function parseMoney(input: string, currency: Currency): number {
  const digits = currencyDigits(currency);
  if (
    !new RegExp("^\\d{1,9}(?:\\.\\d{1," + Math.max(1, digits) + "})?$").test(
      input.trim(),
    )
  )
    throw new Error("Enter a positive amount using a decimal point.");
  const [whole = "0", fraction = ""] = input.trim().split(".");
  if (digits === 0 && fraction)
    throw new Error(currency + " uses whole currency units.");
  const minor =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  if (minor > 1_000_000_000n) throw new Error("This amount is too large.");
  return Number(minor);
}
export function moneyInput(minor: number, currency: Currency): string {
  const digits = currencyDigits(currency),
    scale = 10n ** BigInt(digits),
    amount = BigInt(minor);
  return (
    (amount / scale).toString() +
    (digits ? "." + (amount % scale).toString().padStart(digits, "0") : "")
  );
}
export function formatMoney(
  minor: number,
  currency: Currency,
  compact = false,
): string {
  // Only formatting uses Number; financial arithmetic below stays in integer/rational units.
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: currencyDigits(currency),
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(Number(moneyInput(minor, currency)));
}
type Fraction = { numerator: bigint; denominator: bigint };
function annualFraction(s: Subscription): Fraction {
  const count = BigInt(s.intervalCount),
    amount = BigInt(s.amountMinor);
  switch (s.interval) {
    case "weekly":
      return { numerator: amount * 365n, denominator: 7n * count };
    case "monthly":
      return { numerator: amount * 12n, denominator: count };
    case "quarterly":
      return { numerator: amount * 4n, denominator: count };
    case "yearly":
      return { numerator: amount, denominator: count };
    case "custom":
      switch (s.customUnit) {
        case "day":
          return { numerator: amount * 365n, denominator: count };
        case "week":
          return { numerator: amount * 365n, denominator: count * 7n };
        case "month":
          return { numerator: amount * 12n, denominator: count };
        case "year":
          return { numerator: amount, denominator: count };
      }
  }
}
function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
}
function add(a: Fraction, b: Fraction): Fraction {
  const numerator = a.numerator * b.denominator + b.numerator * a.denominator,
    denominator = a.denominator * b.denominator;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}
function round(f: Fraction): number {
  return Number((f.numerator * 2n + f.denominator) / (2n * f.denominator));
}
export function recurringTotals(
  subscriptions: Subscription[],
): { currency: Currency; monthly: number; annual: number; count: number }[] {
  const groups = new Map<Currency, { value: Fraction; count: number }>();
  for (const s of subscriptions) {
    if (s.status !== "active" && s.status !== "trial") continue;
    const group = groups.get(s.currency) || {
      value: { numerator: 0n, denominator: 1n },
      count: 0,
    };
    groups.set(s.currency, {
      value: add(group.value, annualFraction(s)),
      count: group.count + 1,
    });
  }
  return Array.from(groups, ([currency, group]) => ({
    currency,
    annual: round(group.value),
    monthly: round({
      numerator: group.value.numerator,
      denominator: group.value.denominator * 12n,
    }),
    count: group.count,
  }));
}
export function annualCost(s: Subscription): number {
  return round(annualFraction(s));
}
