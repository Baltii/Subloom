import { Temporal } from "@js-temporal/polyfill";
import { daysBetween, nextEvent, today } from "./renewal.ts";
import type { Preferences, Subscription } from "./models.ts";
export type Reminder = {
  key: string;
  subscriptionId: string;
  version: number;
  eventDate: string;
  kind: "renewal" | "trial";
  daysBefore: number;
  dueAt: string;
};
export function isHighRenewal(s: Subscription, p: Preferences): boolean {
  return (
    p.highRenewalThresholdMinor !== null &&
    s.currency === p.currency &&
    s.amountMinor >= p.highRenewalThresholdMinor
  );
}
export function isQuiet(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}
export function dueReminder(
  s: Subscription,
  preferences: Preferences,
  now: Date,
): Reminder | null {
  if (!preferences.pushEnabled && !preferences.emailEnabled) return null;
  if (s.reminders && !s.reminders.enabled) return null;
  const localNow = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(
    preferences.timezone,
  );
  const reference = today(preferences.timezone, now),
    event = nextEvent(s, reference);
  if (
    !event ||
    event.type === "paid_through" ||
    (event.type === "trial" && !preferences.trialReminders)
  )
    return null;
  const days = daysBetween(reference, event.date);
  if (!(s.reminders?.days ?? preferences.reminderDays).includes(days))
    return null;
  let hour = preferences.reminderHour;
  if (isQuiet(hour, preferences.quietStart, preferences.quietEnd))
    hour = preferences.quietEnd;
  if (
    localNow.hour < hour ||
    isQuiet(localNow.hour, preferences.quietStart, preferences.quietEnd)
  )
    return null;
  const dueAt = Temporal.PlainDate.from(reference)
    .toZonedDateTime({
      timeZone: preferences.timezone,
      plainTime: Temporal.PlainTime.from({ hour }),
    })
    .toInstant()
    .toString();
  return {
    key: [s.id, s.version, event.type, event.date, days].join(":"),
    subscriptionId: s.id,
    version: s.version,
    eventDate: event.date,
    kind: event.type,
    daysBefore: days,
    dueAt,
  };
}
