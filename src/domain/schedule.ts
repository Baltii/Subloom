import { Temporal } from "@js-temporal/polyfill";
import type { Subscription } from "./models";
import { dateSchema } from "./models";
import { nextEvent } from "./renewal";

export type BillingEvent = {
  id: string;
  date: string;
  type: "renewal" | "trial" | "paid_through";
  subscription: Subscription;
};

// Date-only, inclusive start / exclusive end. Never turn projections into payments.
export function billingEvents(
  subscriptions: Subscription[],
  start: string,
  end: string,
): BillingEvent[] {
  dateSchema.parse(start);
  dateSchema.parse(end);
  if (
    end <= start ||
    Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(end)).days >
      366
  )
    throw new Error("Choose a calendar range of up to one year.");
  const events: BillingEvent[] = [];
  for (const subscription of subscriptions) {
    let reference =
      subscription.startDate > start ? subscription.startDate : start;
    while (reference < end) {
      const event = nextEvent(subscription, reference);
      if (!event || event.date >= end) break;
      if (events.length >= 10000)
        throw new Error(
          "Too many scheduled events. View fewer subscriptions or a shorter range.",
        );
      events.push({
        ...event,
        subscription,
        id: `${subscription.id}:${event.type}:${event.date}`,
      });
      if (event.type === "paid_through") break;
      reference = Temporal.PlainDate.from(event.date)
        .add({ days: 1 })
        .toString();
    }
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.subscription.name.localeCompare(b.subscription.name),
  );
}
