import { Temporal } from "@js-temporal/polyfill";
import type { Category, Currency, Subscription } from "./models";
import { recurringTotals } from "./money";
import { billingEvents } from "./schedule";

export function categorySpending(
  subscriptions: Subscription[],
  currency: Currency,
  period: "monthly" | "annual" = "monthly",
) {
  const groups = new Map<Category, Subscription[]>();
  for (const subscription of subscriptions) {
    if (
      subscription.currency !== currency ||
      !["active", "trial"].includes(subscription.status)
    )
      continue;
    const group = groups.get(subscription.category) ?? [];
    group.push(subscription);
    groups.set(subscription.category, group);
  }
  return [...groups]
    .map(([category, rows]) => ({
      category,
      amount: recurringTotals(rows)[0]![period],
      count: rows.length,
    }))
    .sort(
      (a, b) => b.amount - a.amount || a.category.localeCompare(b.category),
    );
}

export function renewalForecast(
  subscriptions: Subscription[],
  currency: Currency,
  reference: string,
) {
  const first = Temporal.PlainDate.from(reference).with({ day: 1 });
  const months = Array.from({ length: 6 }, (_, index) => ({
    month: first.add({ months: index }).toString(),
    amount: 0,
    count: 0,
    events: [] as ReturnType<typeof billingEvents>,
  }));
  const byMonth = new Map(
    months.map((month) => [month.month.slice(0, 7), month]),
  );
  for (const event of billingEvents(
    subscriptions.filter((s) => s.currency === currency),
    reference,
    first.add({ months: 6 }).toString(),
  )) {
    if (event.type === "paid_through") continue;
    const month = byMonth.get(event.date.slice(0, 7))!;
    month.amount += event.subscription.amountMinor;
    month.count++;
    month.events.push(event);
  }
  return months;
}
