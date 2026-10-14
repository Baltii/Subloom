import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import {
  currencies,
  dateSchema,
  type Currency,
  type Subscription,
} from "./models";
import { recurringTotals, ratioMinor } from "./money";
import { billingEvents } from "./schedule";
import { daysBetween, nextEvent, hasAnnualCadence } from "./renewal";
export const reserveSchema = z
  .object({
    payday: dateSchema.nullable(),
    buckets: z
      .array(
        z
          .object({
            currency: z.enum(currencies),
            plannedMinor: z.number().int().min(0).max(1_000_000_000),
          })
          .strict(),
      )
      .max(10),
  })
  .strict()
  .refine(
    (v) => new Set(v.buckets.map((b) => b.currency)).size === v.buckets.length,
    "Keep one planning bucket per currency.",
  );
export type Reserve = z.infer<typeof reserveSchema>;
export const emptyReserve: Reserve = { payday: null, buckets: [] };
export function reservePlan(
  subscriptions: Subscription[],
  settings: Reserve,
  reference: string,
) {
  const annual = subscriptions.filter(hasAnnualCadence);
  const monthly = recurringTotals(annual);
  const rows = annual
    .flatMap((s) => {
      const event = nextEvent(s, reference);
      if (!event || event.type === "paid_through") return [];
      const days = daysBetween(reference, event.date);
      const months = Math.max(1, Math.floor(days / 30));
      return [
        {
          subscription: s,
          date: event.date,
          monthlyNeeded: ratioMinor(s.amountMinor, 1, months, "up"),
          periods: months,
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const payday =
    settings.payday ??
    Temporal.PlainDate.from(reference).add({ days: 30 }).toString();
  if (payday <= reference || daysBetween(reference, payday) > 366)
    throw new Error("Set a next payday after today and within one year.");
  const charges = billingEvents(subscriptions, reference, payday).filter(
    (e) => e.type !== "paid_through",
  );
  const amounts = new Map<Currency, number>();
  for (const event of charges)
    amounts.set(
      event.subscription.currency,
      (amounts.get(event.subscription.currency) ?? 0) +
        event.subscription.amountMinor,
    );
  const funding = [
    ...new Set([...amounts.keys(), ...settings.buckets.map((b) => b.currency)]),
  ].map((currency) => {
    const dueMinor = amounts.get(currency) ?? 0,
      plannedMinor =
        settings.buckets.find((b) => b.currency === currency)?.plannedMinor ??
        0;
    return {
      currency,
      dueMinor,
      plannedMinor,
      gapMinor: Math.max(0, dueMinor - plannedMinor),
    };
  });
  return { monthly, rows, payday, charges, funding };
}
