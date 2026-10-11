import { pricePointSchema, type PricePoint, type Subscription } from "./models";
export function pricePoint(
  s: Subscription,
  source: PricePoint["source"] = "recorded",
  capturedAt = s.updatedAt,
): PricePoint {
  return pricePointSchema.parse({
    subscriptionId: s.id,
    version: s.version,
    amountMinor: s.amountMinor,
    currency: s.currency,
    interval: s.interval,
    intervalCount: s.intervalCount,
    customUnit: s.customUnit,
    capturedAt,
    source,
  });
}
export function priceChanged(a: Subscription, b: Subscription) {
  return [
    "amountMinor",
    "currency",
    "interval",
    "intervalCount",
    "customUnit",
  ].some(
    (key) => a[key as keyof Subscription] !== b[key as keyof Subscription],
  );
}
export function recordPrice(
  history: PricePoint[],
  previous: Subscription | undefined,
  next: Subscription,
): PricePoint[] {
  if (previous && !priceChanged(previous, next)) return history;
  const before =
    previous && !history.some((p) => p.subscriptionId === previous.id)
      ? [pricePoint(previous, "baseline")]
      : [];
  return [...history, ...before, pricePoint(next)];
}
export function priceDifference(previous: PricePoint, current: PricePoint) {
  if (
    previous.currency !== current.currency ||
    previous.interval !== current.interval ||
    previous.intervalCount !== current.intervalCount ||
    previous.customUnit !== current.customUnit
  )
    return null;
  return current.amountMinor - previous.amountMinor;
}
