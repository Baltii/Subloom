import { Temporal } from "@js-temporal/polyfill";
import type { Snapshot } from "./models";
import { formatMoney } from "./money";
import { dateLabel, daysBetween, nextEvent, today } from "./renewal";
import { billingEvents, type BillingEvent } from "./schedule";

type Renewal = Pick<BillingEvent, "date" | "subscription"> & {
  type: "renewal" | "trial";
};

function isRenewal(event: BillingEvent): event is BillingEvent & Renewal {
  return event.type !== "paid_through";
}

export function browserRenewals(
  snapshot: Pick<Snapshot, "subscriptions" | "preferences">,
  now = new Date(),
) {
  const reference = today(snapshot.preferences.timezone, now);
  const day = Temporal.PlainDate.from(reference);
  const monday = day.subtract({ days: day.dayOfWeek - 1 });
  const sunday = monday.add({ days: 6 });
  const subscriptions = snapshot.subscriptions.filter(
    (subscription) =>
      subscription.status === "active" || subscription.status === "trial",
  );
  const next = subscriptions
    .flatMap((subscription) => {
      const event = nextEvent(
        subscription,
        subscription.startDate > reference ? subscription.startDate : reference,
      );
      return event && event.type !== "paid_through"
        ? [{ subscription, date: event.date, type: event.type }]
        : [];
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(b.type === "trial") - Number(a.type === "trial") ||
        a.subscription.name.localeCompare(b.subscription.name),
    )[0];

  const display = ({ subscription, date, type }: Renewal) => ({
    id: subscription.id,
    name: subscription.name,
    type,
    date: dateLabel(date, {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(Temporal.PlainDate.from(date).year !== day.year && {
        year: "numeric",
      }),
    }),
    days: daysBetween(reference, date),
    amount: formatMoney(subscription.amountMinor, subscription.currency),
  });

  return {
    next: next ? display(next) : null,
    week: billingEvents(
      subscriptions,
      reference,
      sunday.add({ days: 1 }).toString(),
    )
      .filter(isRenewal)
      .map(display),
    weekLabel: `${dateLabel(monday.toString())} – ${dateLabel(sunday.toString())}`,
  };
}
