import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { currencies, dateSchema, type Subscription } from "./models";
import { ratioMinor, recurringTotals } from "./money";
import type { PaymentTransaction } from "./radar";
export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((v) => {
    try {
      Temporal.PlainYearMonth.from(v);
      return true;
    } catch {
      return false;
    }
  }, "Use a valid YYYY-MM month.");
export const checkinSchema = z
  .object({
    subscriptionId: z.string().uuid(),
    month: monthSchema,
    uses: z.number().int().min(0).max(10000),
    goal: z.enum(["keep", "review", "rotate"]),
  })
  .strict();
export const quoteSchema = z
  .object({
    subscriptionId: z.string().uuid(),
    currency: z.enum(currencies),
    monthlyMinor: z.number().int().min(0).max(1_000_000_000),
    annualMinor: z.number().int().min(0).max(1_000_000_000),
    reference: z.string().trim().min(1).max(160),
    confirmedDate: dateSchema,
  })
  .strict();
export const coachSchema = z
  .object({
    checkins: z.array(checkinSchema).max(200),
    quotes: z.array(quoteSchema).max(200),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.checkins.map((c) => c.subscriptionId + ":" + c.month)).size ===
        v.checkins.length &&
      new Set(v.quotes.map((q) => q.subscriptionId)).size === v.quotes.length,
    "Keep one check-in per month and one current quote per service.",
  );
export type Coach = z.infer<typeof coachSchema>;
export const emptyCoach: Coach = { checkins: [], quotes: [] };
export function costPerUse(
  s: Subscription,
  checkin: z.infer<typeof checkinSchema>,
  ledger: PaymentTransaction[],
) {
  const rows = ledger.filter(
    (t) =>
      t.subscriptionId === s.id &&
      !t.ignored &&
      t.currency === s.currency &&
      t.date.startsWith(checkin.month),
  );
  const net = rows.reduce(
    (sum, t) =>
      sum + (t.direction === "debit" ? t.amountMinor : -t.amountMinor),
    0,
  );
  const estimate = recurringTotals([s])[0]?.monthly ?? null;
  const totalMinor = rows.length ? Math.max(0, net) : estimate;
  return {
    totalMinor,
    perUseMinor:
      checkin.uses && totalMinor !== null
        ? ratioMinor(totalMinor, 1, checkin.uses)
        : null,
    basis: rows.length
      ? "Matched imported net charges"
      : "Current monthly recurring estimate",
    creditMinor: rows.length && net < 0 ? -net : 0,
  };
}
export function offerComparison(quote: z.infer<typeof quoteSchema>) {
  quoteSchema.parse(quote);
  return {
    annualSavingMinor: quote.monthlyMinor * 12 - quote.annualMinor,
    breakEvenMonths: quote.monthlyMinor
      ? ratioMinor(quote.annualMinor, 1, quote.monthlyMinor, "up")
      : null,
  };
}
export function rotationPlan(
  subscriptions: Subscription[],
  ids: string[],
  month: string,
) {
  monthSchema.parse(month);
  const chosen = subscriptions.filter((s) => ids.includes(s.id));
  if (
    chosen.length < 2 ||
    chosen.length > 12 ||
    chosen.length !== new Set(ids).size ||
    new Set(ids).size !== ids.length
  )
    return null;
  const first = chosen[0]!;
  if (
    chosen.some(
      (s) =>
        s.currency !== first.currency ||
        s.category !== first.category ||
        s.status !== "active" ||
        s.interval !== "monthly" ||
        s.intervalCount !== 1,
    )
  )
    return null;
  const schedule = Array.from({ length: 12 }, (_, i) => ({
    month: Temporal.PlainYearMonth.from(month).add({ months: i }).toString(),
    subscription: chosen[i % chosen.length]!,
  }));
  const baselineMinor = chosen.reduce((n, s) => n + s.amountMinor, 0) * 12,
    plannedMinor = schedule.reduce(
      (n, row) => n + row.subscription.amountMinor,
      0,
    );
  return {
    currency: first.currency,
    schedule,
    baselineMinor,
    plannedMinor,
    savingMinor: baselineMinor - plannedMinor,
  };
}
export function possibleOverlap(subscriptions: Subscription[]) {
  const groups = new Map<string, Subscription[]>();
  for (const s of subscriptions)
    if (s.status === "active" || s.status === "trial") {
      const key = s.category + ":" + s.currency;
      const rows = groups.get(key) ?? [];
      rows.push(s);
      groups.set(key, rows);
    }
  return [...groups.values()].filter((rows) => rows.length > 1);
}
