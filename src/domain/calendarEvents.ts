import { Temporal } from "@js-temporal/polyfill";
import type { Currency, Subscription } from "./models";
import { dateSchema } from "./models";
import type { cancellationSchema } from "./cancellation";
import type { z } from "zod";
import { billingEvents, type BillingEvent } from "./schedule";

export type CalendarEvent = Omit<BillingEvent, "type"> & {
  type: BillingEvent["type"] | "deadline" | "start";
};
export const calendarEventLabels: Record<CalendarEvent["type"], string> = {
  renewal: "Renewal",
  trial: "Trial ends",
  paid_through: "Access ends",
  deadline: "Cancellation target",
  start: "Subscription starts",
};
export function monthEvents(
  subscriptions: Subscription[],
  month: string,
  plans: z.infer<typeof cancellationSchema> = {},
): CalendarEvent[] {
  const start = Temporal.PlainDate.from(month).with({ day: 1 }).toString();
  const end = Temporal.PlainDate.from(start).add({ months: 1 }).toString();
  const events: CalendarEvent[] = billingEvents(subscriptions, start, end);
  for (const subscription of subscriptions) {
    if (subscription.startDate >= start && subscription.startDate < end)
      events.push({
        id: `${subscription.id}:start:${subscription.startDate}`,
        date: subscription.startDate,
        type: "start",
        subscription,
      });
    const deadline = plans[subscription.id]?.deadline;
    if (
      deadline &&
      deadline >= start &&
      deadline < end &&
      !["canceled", "expired"].includes(subscription.status)
    )
      events.push({
        id: `${subscription.id}:deadline:${deadline}`,
        date: deadline,
        type: "deadline",
        subscription,
      });
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.type.localeCompare(b.type) ||
      a.subscription.name.localeCompare(b.subscription.name),
  );
}
export function scheduledCharges(events: CalendarEvent[]) {
  const totals = new Map<Currency, number>();
  for (const event of events) {
    if (event.type !== "renewal" && event.type !== "trial") continue;
    totals.set(
      event.subscription.currency,
      (totals.get(event.subscription.currency) ?? 0) +
        event.subscription.amountMinor,
    );
  }
  return [...totals]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
export function quickAddDates(value: unknown, reference: string) {
  const date =
    typeof value === "string" && dateSchema.safeParse(value).success
      ? value
      : dateSchema.parse(reference);
  return { nextRenewal: date, startDate: date < reference ? date : reference };
}
