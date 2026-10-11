import { Temporal } from "@js-temporal/polyfill";
import type { Subscription } from "./models";
import { nextEvent, today } from "./renewal";
import { formatMoney } from "./money";
export function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
export function foldIcs(line: string) {
  const parts: string[] = [];
  let part = "",
    bytes = 0;
  for (const c of line) {
    const size = new TextEncoder().encode(c).length;
    if (bytes + size > 75) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += c;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
}
export function exportIcs(
  subscriptions: Subscription[],
  timezone: string,
  privateContent = true,
  now = new Date(),
) {
  const start = today(timezone, now),
    end = Temporal.PlainDate.from(start).add({ years: 1 }).toString();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Subloom//Renewals//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  let count = 0;
  for (const s of subscriptions) {
    let reference = start;
    while (reference < end) {
      const event = nextEvent(s, reference);
      if (!event || event.date >= end) break;
      if (++count > 10000)
        throw new Error(
          "Too many calendar events. Export fewer subscriptions.",
        );
      const next = Temporal.PlainDate.from(event.date)
        .add({ days: 1 })
        .toString();
      const kind =
        event.type === "trial"
          ? "Trial ends"
          : event.type === "paid_through"
            ? "Access ends"
            : "Renewal";
      lines.push(
        "BEGIN:VEVENT",
        "UID:" + s.id + "-" + event.date + "-" + event.type + "@subloom",
        "DTSTAMP:" + stamp,
        "DTSTART;VALUE=DATE:" + event.date.replace(/-/g, ""),
        "DTEND;VALUE=DATE:" + next.replace(/-/g, ""),
        "SUMMARY:" +
          escapeIcs(
            privateContent
              ? "Subscription " + kind.toLowerCase()
              : s.name + " · " + kind,
          ),
        "DESCRIPTION:" +
          escapeIcs(
            privateContent
              ? "Open Subloom for subscription details."
              : "Recorded price: " +
                  formatMoney(s.amountMinor, s.currency) +
                  ". Scheduled date, not a payment confirmation.",
          ),
        "CLASS:PRIVATE",
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
      if (event.type === "paid_through") break;
      reference = next;
    }
  }
  lines.push("END:VCALENDAR");
  return { text: lines.map(foldIcs).join("\r\n") + "\r\n", count };
}
