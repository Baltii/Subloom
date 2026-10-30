import { Temporal } from "@js-temporal/polyfill";
import type { Snapshot } from "./models";
import { formatMoney } from "./money";
import { nextEvent, today } from "./renewal";

export type WidgetEntry = {
  from: number;
  name: string;
  label: string;
  date: string;
  amount: string;
  path: string;
};
export type WidgetSnapshot = {
  version: 1;
  timezone: string;
  expiresAt: number;
  mode: "ready" | "private" | "setup";
  entries: WidgetEntry[];
};
// A bounded, offline timeline. Native widgets discard it after 90 days rather
// than displaying a stale charge indefinitely when Subloom has not been opened.
export function widgetSnapshot(
  snapshot: Snapshot | null,
  protectedApp: boolean,
  now = new Date(),
): WidgetSnapshot {
  const timezone = snapshot?.preferences.timezone ?? "UTC";
  const start = Temporal.PlainDate.from(today(timezone, now));
  const midnight = (date: Temporal.PlainDate) =>
    date.toZonedDateTime(timezone).epochMilliseconds;
  const result: WidgetSnapshot = {
    version: 1,
    timezone,
    expiresAt: midnight(start.add({ days: 90 })),
    mode:
      protectedApp || snapshot?.preferences.privacyMode
        ? "private"
        : !snapshot || snapshot.demo || !snapshot.onboarded
          ? "setup"
          : "ready",
    entries: [],
  };
  if (result.mode !== "ready" || !snapshot) return result;
  let previous = "";
  for (let day = 0; day < 90; day++) {
    const reference = start.add({ days: day });
    const candidates = snapshot.subscriptions
      .flatMap((subscription) => {
        const event = nextEvent(subscription, reference.toString());
        return event && event.type !== "paid_through"
          ? [{ subscription, ...event }]
          : [];
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          // Trial deadlines win ties; IDs give stable ordering across syncs.
          Number(b.type === "trial") - Number(a.type === "trial") ||
          a.subscription.id.localeCompare(b.subscription.id),
      );
    const next = candidates[0];
    const key = next
      ? `${next.subscription.id}:${next.type}:${next.date}`
      : "empty";
    if (key === previous) continue;
    previous = key;
    result.entries.push({
      from: midnight(reference),
      name: next?.subscription.name ?? "All clear",
      label: next
        ? next.type === "trial"
          ? "Trial ends"
          : "Renews"
        : "No upcoming renewals or trials",
      date: next?.date ?? "",
      amount: next
        ? formatMoney(next.subscription.amountMinor, next.subscription.currency)
        : "",
      path: next ? `/subscription/${next.subscription.id}` : "/",
    });
  }
  return result;
}
