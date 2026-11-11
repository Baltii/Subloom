import { Temporal } from "@js-temporal/polyfill";
import type { AssistantAction } from "./assistantProtocol.ts";
import { dateSchema } from "./models.ts";
import { dateLabel } from "./renewal.ts";

export type AssistantAnalytics = Extract<
  AssistantAction,
  { kind: "analytics" }
>;

// Local date-only boundaries: inclusive start, exclusive end. Calendar weeks
// run Monday–Sunday; "next 7 days" includes today and the following six days.
export function assistantDateRange(action: AssistantAnalytics, today: string) {
  const current = Temporal.PlainDate.from(today);
  let start: Temporal.PlainDate;
  let end: Temporal.PlainDate;
  if (action.period === "dates") {
    const from = dateSchema.safeParse(action.from).data;
    const through = dateSchema.safeParse(action.through).data;
    if (!from || !through || through < from) return null;
    start = Temporal.PlainDate.from(from);
    end = Temporal.PlainDate.from(through).add({ days: 1 });
    if (start.until(end).days > 366) return null;
  } else if (action.period === "today" || action.period === "tomorrow") {
    start = current.add({ days: action.period === "tomorrow" ? 1 : 0 });
    end = start.add({ days: 1 });
  } else if (action.period === "next_7_days") {
    start = current;
    end = current.add({ days: 7 });
  } else if (action.period === "this_week" || action.period === "next_week") {
    start = current
      .subtract({ days: current.dayOfWeek - 1 })
      .add({ weeks: action.period === "next_week" ? 1 : 0 });
    end = start.add({ weeks: 1 });
  } else {
    const annual =
      action.period === "this_year" || action.period === "next_year";
    const next =
      action.period === "next_month" || action.period === "next_year";
    start = annual
      ? current.with({ month: 1, day: 1 }).add({ years: next ? 1 : 0 })
      : current.with({ day: 1 }).add({ months: next ? 1 : 0 });
    end = start.add(annual ? { years: 1 } : { months: 1 });
  }
  const originalStart = start;
  if (
    action.metric === "remaining" &&
    Temporal.PlainDate.compare(start, current) < 0
  )
    start = Temporal.PlainDate.compare(current, end) >= 0 ? end : current;
  const labelStart = start.equals(end) ? originalStart : start;
  const label =
    action.metric !== "remaining" &&
    ["this_month", "next_month"].includes(action.period)
      ? dateLabel(start.toString(), { month: "long", year: "numeric" })
      : action.metric !== "remaining" &&
          ["this_year", "next_year"].includes(action.period)
        ? String(start.year)
        : dateLabel(labelStart.toString(), {
            month: "short",
            day: "numeric",
            year: "numeric",
          }) +
          " to " +
          dateLabel(end.subtract({ days: 1 }).toString(), {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
  return { from: start.toString(), end: end.toString(), label };
}
