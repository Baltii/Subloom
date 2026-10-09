import { describe, expect, it } from "vitest";
import {
  calendarDays,
  calendarMonth,
  moveCalendarMonth,
} from "../../src/domain/calendar";

describe("date picker calendar", () => {
  it("opens a valid selected month without UTC or local timezone conversion", () => {
    expect(calendarMonth("2026-10-31", "2026-11-01")).toBe("2026-10-01");
  });
  it("keeps missing and invalid receipt dates blank while the calendar opens at today", () => {
    expect(calendarMonth("", "2026-10-09")).toBe("2026-10-01");
    expect(calendarMonth("2026-02-30", "2026-10-09")).toBe("2026-10-01");
  });
  it("moves across year boundaries without skipping February", () => {
    expect(moveCalendarMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(moveCalendarMonth("2027-01-01", -1)).toBe("2026-12-01");
    expect(moveCalendarMonth("2026-01-31", 1)).toBe("2026-02-01");
  });
  it("uses a Monday-first complete week grid", () => {
    const cells = calendarDays("2026-10-01");
    expect(cells.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
  it("renders leap days only when they exist", () => {
    expect(calendarDays("2028-02-01")).toContain("2028-02-29");
    expect(calendarDays("2027-02-01")).not.toContain("2027-02-29");
  });
  it("has no leading padding for a Monday month and six weeks for a long Sunday month", () => {
    expect(calendarDays("2026-06-01")[0]).toBe("2026-06-01");
    expect(calendarDays("2026-03-01")).toHaveLength(42);
  });
});
