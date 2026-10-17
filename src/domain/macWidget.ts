import { Temporal } from "@js-temporal/polyfill";
import type { Snapshot } from "./models";
import { nextEvent, today, daysBetween } from "./renewal";

export const widgetDays = 35;
export type WidgetDay = {
  at: number;
  name: string | null;
  subscriptionId: string | null;
  kind: "renewal" | "trial" | null;
  dueDate: string | null;
  days: number | null;
};
export type MacWidgetPayload = {
  version: 1;
  owner: string;
  generatedAt: number;
  validUntil: number;
  timezone: string;
  isPrivate: boolean;
  entries: WidgetDay[];
};

// Share only the nearest event per day, never the full workspace or auth data.
export function macWidgetPayload(
  snapshot: Snapshot,
  owner: string,
  now = new Date(),
): MacWidgetPayload {
  const timezone = snapshot.preferences.timezone;
  const reference = Temporal.PlainDate.from(today(timezone, now));
  const instant = (date: Temporal.PlainDate) =>
    date.toZonedDateTime(timezone).epochMilliseconds / 1000;
  const visible = snapshot.onboarded && !snapshot.demo;
  const isPrivate = snapshot.preferences.privacyMode;
  const subscriptions = visible
    ? snapshot.subscriptions.filter((s) =>
        ["active", "trial"].includes(s.status),
      )
    : [];
  const candidates = subscriptions.map((subscription) => ({
    subscription,
    event: nextEvent(subscription, reference.toString()),
  }));
  const entries = Array.from({ length: widgetDays }, (_, offset): WidgetDay => {
    const date = reference.add({ days: offset }).toString();
    let nearest: {
      subscription: (typeof subscriptions)[number];
      date: string;
      type: "renewal" | "trial";
    } | null = null;
    for (const candidate of candidates) {
      if (candidate.event && candidate.event.date < date)
        candidate.event = nextEvent(candidate.subscription, date);
      const event = candidate.event;
      if (!event || event.type === "paid_through") continue;
      if (
        !nearest ||
        event.date < nearest.date ||
        (event.date === nearest.date &&
          ((event.type === "trial" && nearest.type !== "trial") ||
            (event.type === nearest.type &&
              candidate.subscription.id < nearest.subscription.id)))
      )
        nearest = {
          subscription: candidate.subscription,
          date: event.date,
          type: event.type,
        };
    }
    return {
      at: instant(Temporal.PlainDate.from(date)),
      name: nearest && !isPrivate ? nearest.subscription.name : null,
      subscriptionId: nearest && !isPrivate ? nearest.subscription.id : null,
      kind: nearest?.type ?? null,
      dueDate: nearest?.date ?? null,
      days: nearest ? daysBetween(date, nearest.date) : null,
    };
  });
  return {
    version: 1,
    owner,
    generatedAt: now.getTime() / 1000,
    validUntil: instant(reference.add({ days: widgetDays })),
    timezone,
    isPrivate,
    entries,
  };
}
