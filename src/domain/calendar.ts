import { Temporal } from "@js-temporal/polyfill";

export function calendarMonth(date: string, fallback: string) {
  let parsed: Temporal.PlainDate;
  try {
    parsed = Temporal.PlainDate.from(date);
  } catch {
    parsed = Temporal.PlainDate.from(fallback);
  }
  return parsed.with({ day: 1 }).toString();
}
export function moveCalendarMonth(month: string, amount: number) {
  return Temporal.PlainDate.from(month)
    .with({ day: 1 })
    .add({ months: amount })
    .toString();
}
export function calendarDays(month: string): (string | null)[] {
  const first = Temporal.PlainDate.from(month).with({ day: 1 });
  const cells: (string | null)[] = Array(first.dayOfWeek - 1).fill(null);
  for (let day = 1; day <= first.daysInMonth; day++)
    cells.push(first.with({ day }).toString());
  while (cells.length % 7) cells.push(null);
  return cells;
}
