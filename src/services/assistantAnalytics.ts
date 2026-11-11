import { Temporal } from "@js-temporal/polyfill";
import type { AssistantAction } from "../domain/assistantProtocol";
import { scheduledCharges } from "../domain/calendarEvents";
import { dateSchema, type Currency, type Subscription } from "../domain/models";
import { formatMoney, recurringTotals } from "../domain/money";
import { dateLabel } from "../domain/renewal";
import { billingEvents, type BillingEvent } from "../domain/schedule";
import type { AssistantReply } from "./assistantActions";

type Analytics = Extract<AssistantAction, { kind: "analytics" }>;

function dateRange(action: Analytics, today: string) {
  const current = Temporal.PlainDate.from(today);
  if (action.period === "dates") {
    const from = dateSchema.safeParse(action.from).data;
    const through = dateSchema.safeParse(action.through).data;
    if (!from || !through || through < from) return null;
    const end = Temporal.PlainDate.from(through).add({ days: 1 });
    if (Temporal.PlainDate.from(from).until(end).days > 366) return null;
    return {
      from,
      end: end.toString(),
      label: dateLabel(from) + " to " + dateLabel(through),
    };
  }
  const annual = action.period === "this_year" || action.period === "next_year";
  const next = action.period === "next_month" || action.period === "next_year";
  const start = annual
    ? current.with({ month: 1, day: 1 }).add({ years: next ? 1 : 0 })
    : current.with({ day: 1 }).add({ months: next ? 1 : 0 });
  return {
    from: start.toString(),
    end: start.add(annual ? { years: 1 } : { months: 1 }).toString(),
    label: annual
      ? String(start.year)
      : dateLabel(start.toString(), { month: "long", year: "numeric" }),
  };
}

function breakdown(
  events: BillingEvent[],
  key: (event: BillingEvent) => string,
) {
  const groups = new Map<
    string,
    { name: string; currency: Currency; amount: number }
  >();
  for (const event of events) {
    const name = key(event);
    const { currency, amountMinor } = event.subscription;
    const id = currency + "\0" + name;
    const previous = groups.get(id);
    groups.set(id, {
      name,
      currency,
      amount: (previous?.amount ?? 0) + amountMinor,
    });
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.currency.localeCompare(b.currency) ||
      b.amount - a.amount ||
      a.name.localeCompare(b.name),
  );
}

export function assistantAnalytics(
  action: Analytics,
  subscriptions: Subscription[],
  today: string,
): AssistantReply {
  if (action.metric === "recurring") {
    const annual =
      action.period === "this_year" || action.period === "next_year";
    const totals = recurringTotals(subscriptions);
    return {
      title: annual ? "Average yearly cost" : "Average monthly cost",
      text: totals.length
        ? "Based on the billing frequency of active plans and trials."
        : "There are no active plans or trials in this selection.",
      rows: totals.map(({ currency, monthly, annual: yearly }) => ({
        label: currency,
        value: formatMoney(annual ? yearly : monthly, currency),
      })),
    };
  }

  const range = dateRange(action, today);
  if (!range)
    return {
      text: "Which dates should I use? Choose a start and end date within one year.",
      awaitingDetails: true,
    };
  const events = billingEvents(subscriptions, range.from, range.end).filter(
    (event) =>
      action.metric === "trials"
        ? event.type === "trial"
        : action.metric === "renewals"
          ? event.type === "renewal"
          : event.type !== "paid_through",
  );
  const title =
    {
      spending: "Estimated spending",
      renewals: "Renewals",
      trials: "Trial endings",
      by_category: "Spending by category",
      most_expensive: "Highest scheduled spending by currency",
    }[action.metric] +
    " · " +
    range.label;
  if (!events.length)
    return { title, text: "There are no matching events in this period." };

  const totals = ["spending", "by_category"].includes(action.metric)
    ? scheduledCharges(events).map(({ currency, amount }) => ({
        label: currency + " total",
        value: formatMoney(amount, currency),
      }))
    : [];
  const grouped =
    action.metric === "by_category" || action.metric === "most_expensive";
  const rows = grouped
    ? breakdown(events, (event) =>
        action.metric === "by_category"
          ? event.subscription.category
          : event.subscription.name,
      ).map(({ name, currency, amount }) => ({
        label: name + " · " + currency,
        value: formatMoney(amount, currency),
      }))
    : events.map(({ subscription, date, type }) => ({
        label: subscription.name,
        value:
          dateLabel(date, { month: "short", day: "numeric", year: "numeric" }) +
          (type === "trial" ? " · Trial ends" : "") +
          (action.metric === "trials"
            ? ""
            : " · " +
              formatMoney(subscription.amountMinor, subscription.currency)),
      }));
  return {
    title,
    text:
      rows.length > 12
        ? "Showing 12 of " +
          rows.length +
          (grouped ? " entries." : " scheduled events.")
        : "Based on your saved billing schedules.",
    rows: [...totals, ...rows.slice(0, 12)],
    next: { label: "Open calendar", route: "/calendar" },
  };
}
