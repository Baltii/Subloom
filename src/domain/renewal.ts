import { Temporal } from "@js-temporal/polyfill";
import type { DateOnly, Subscription } from "./models.ts";

export function today(timezone = "UTC", now = new Date()): DateOnly {
  return Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();
}
export function daysBetween(from: DateOnly, to: DateOnly): number {
  return Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to), {
    largestUnit: "day",
  }).days;
}
export function advanceRenewal(
  date: DateOnly,
  subscription: Pick<
    Subscription,
    "interval" | "intervalCount" | "customUnit" | "anchorDay"
  >,
  periods = 1,
): DateOnly {
  const current = Temporal.PlainDate.from(date),
    count = subscription.intervalCount * periods;
  let next: Temporal.PlainDate;
  switch (subscription.interval) {
    case "weekly":
      next = current.add({ weeks: count });
      break;
    case "monthly":
      next = current.with({ day: 1 }).add({ months: count });
      break;
    case "quarterly":
      next = current.with({ day: 1 }).add({ months: count * 3 });
      break;
    case "yearly":
      next = current.with({ day: 1 }).add({ years: count });
      break;
    case "custom":
      if (subscription.customUnit === "day")
        return current.add({ days: count }).toString();
      if (subscription.customUnit === "week")
        return current.add({ weeks: count }).toString();
      next = current
        .with({ day: 1 })
        .add(
          subscription.customUnit === "month"
            ? { months: count }
            : { years: count },
        );
      break;
  }
  if (subscription.interval === "weekly") return next.toString();
  return next
    .with({ day: Math.min(subscription.anchorDay, next.daysInMonth) })
    .toString();
}
export function nextEvent(
  s: Subscription,
  reference: DateOnly,
): { date: DateOnly; type: "renewal" | "trial" | "paid_through" } | null {
  if (s.status === "paused" || s.status === "expired") return null;
  if (s.status === "canceled")
    return s.paidThrough && s.paidThrough >= reference
      ? { date: s.paidThrough, type: "paid_through" }
      : null;
  if (s.status === "trial" && s.trialEnd && s.trialEnd >= reference)
    return { date: s.trialEnd, type: "trial" };
  let date =
    s.status === "trial" && s.trialEnd && s.trialEnd > s.nextRenewal
      ? s.trialEnd
      : s.nextRenewal;
  if (date < reference) {
    const days = daysBetween(date, reference);
    const step =
      s.interval === "weekly"
        ? 7 * s.intervalCount
        : s.interval === "custom" && s.customUnit === "day"
          ? s.intervalCount
          : s.interval === "custom" && s.customUnit === "week"
            ? 7 * s.intervalCount
            : null;
    if (step) date = advanceRenewal(date, s, Math.floor(days / step));
    else {
      const start = Temporal.PlainDate.from(date),
        end = Temporal.PlainDate.from(reference);
      const months = (end.year - start.year) * 12 + end.month - start.month;
      const stepMonths =
        s.intervalCount *
        (s.interval === "quarterly"
          ? 3
          : s.interval === "yearly" ||
              (s.interval === "custom" && s.customUnit === "year")
            ? 12
            : 1);
      date = advanceRenewal(
        date,
        s,
        Math.max(0, Math.floor(months / stepMonths)),
      );
    }
    if (date < reference) date = advanceRenewal(date, s);
  }
  return { date, type: "renewal" };
}
export function upcoming(
  subscriptions: Subscription[],
  timezone: string,
  now = new Date(),
) {
  const reference = today(timezone, now);
  return subscriptions
    .flatMap((s) => {
      const event = nextEvent(s, reference);
      return event
        ? [
            {
              subscription: s,
              ...event,
              days: daysBetween(reference, event.date),
            },
          ]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function dateLabel(
  date: DateOnly,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export function intervalLabel(
  s: Pick<Subscription, "interval" | "intervalCount" | "customUnit">,
) {
  if (s.interval === "custom")
    return (
      "every " +
      s.intervalCount +
      " " +
      s.customUnit +
      (s.intervalCount > 1 ? "s" : "")
    );
  if (s.intervalCount > 1)
    return (
      "every " +
      s.intervalCount +
      " " +
      {
        weekly: "weeks",
        monthly: "months",
        quarterly: "quarters",
        yearly: "years",
      }[s.interval]
    );
  return {
    weekly: "week",
    monthly: "month",
    quarterly: "quarter",
    yearly: "year",
  }[s.interval];
}
