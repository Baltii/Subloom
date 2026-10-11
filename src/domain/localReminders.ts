import { Temporal } from "@js-temporal/polyfill";
import type { Snapshot } from "./models";
import { isQuiet } from "./reminders";
import { nextEvent, today } from "./renewal";
import { formatMoney } from "./money";

export type LocalReminder = {
  id: string;
  title: string;
  body: string;
  at: string;
  path: string;
};
// Reserve room for a test notification. Refresh on edits, launch and foreground.
export const localReminderLimit = 48;
export function localReminderPlan(
  snapshot: Snapshot,
  now = new Date(),
): LocalReminder[] {
  if (snapshot.demo || !snapshot.onboarded) return [];
  const p = snapshot.preferences;
  const reference = Temporal.PlainDate.from(today(p.timezone, now));
  const horizon = reference.add({ days: 365 });
  const results: LocalReminder[] = [];
  for (const s of snapshot.subscriptions) {
    if (s.reminders?.enabled === false) continue;
    const days = [...new Set(s.reminders?.days ?? p.reminderDays)];
    if (!days.length) continue;
    let cursor = reference.toString();
    for (let count = 0; count < 400; count++) {
      const event = nextEvent(s, cursor);
      if (!event || event.type === "paid_through") break;
      const date = Temporal.PlainDate.from(event.date);
      if (Temporal.PlainDate.compare(date, horizon.add({ days: 30 })) > 0)
        break;
      if (event.type !== "trial" || p.trialReminders) {
        for (const lead of days) {
          let due = date.subtract({ days: lead }).toZonedDateTime({
            timeZone: p.timezone,
            plainTime: Temporal.PlainTime.from({ hour: p.reminderHour }),
          });
          if (isQuiet(p.reminderHour, p.quietStart, p.quietEnd)) {
            if (p.quietStart > p.quietEnd && p.reminderHour >= p.quietStart)
              due = due.add({ days: 1 });
            due = due.with({ hour: p.quietEnd, minute: 0, second: 0 });
          }
          if (
            due.epochMilliseconds <= now.getTime() ||
            Temporal.PlainDate.compare(due.toPlainDate(), horizon) > 0
          )
            continue;
          const trial = event.type === "trial";
          results.push({
            id: [s.id, s.version, event.type, event.date, lead].join(":"),
            title: p.privacyMode
              ? "Subloom reminder"
              : `${s.name} ${trial ? "trial ending" : "renewal"}`,
            body: p.privacyMode
              ? "A subscription needs your attention. Open Subloom to see the details."
              : `${trial ? "Trial ends" : "Renews"} ${event.date}${trial ? "" : " · " + formatMoney(s.amountMinor, s.currency)}.`,
            at: due.toInstant().toString(),
            path: "/subscription/" + s.id,
          });
        }
      }
      cursor = date.add({ days: 1 }).toString();
    }
  }
  return results
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .slice(0, localReminderLimit);
}
