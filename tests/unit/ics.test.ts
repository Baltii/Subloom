import { it, expect } from "vitest";
import { subscription } from "../fixtures";
import { exportIcs, foldIcs, escapeIcs } from "../../src/domain/ics";
it("exports anchored monthly all-day dates and stable UIDs", () => {
  const result = exportIcs(
    [subscription()],
    "UTC",
    false,
    new Date("2026-01-31T12:00:00Z"),
  );
  expect(result.count).toBe(12);
  expect(result.text).toContain("DTSTART;VALUE=DATE:20260228");
  expect(result.text).toContain("DTEND;VALUE=DATE:20260301");
  expect(result.text).toContain("DTSTART;VALUE=DATE:20260331");
});
it("keeps details private by default and respects status", () => {
  const s = subscription();
  const now = new Date("2026-01-31T12:00:00Z");
  expect(exportIcs([s], "UTC", true, now).text).not.toContain("Spotify");
  expect(exportIcs([{ ...s, status: "paused" }], "UTC", false, now).count).toBe(
    0,
  );
  expect(
    exportIcs(
      [{ ...s, status: "canceled", paidThrough: "2026-02-01" }],
      "UTC",
      false,
      now,
    ).count,
  ).toBe(1);
  expect(
    exportIcs(
      [{ ...s, status: "trial", trialEnd: "2026-02-02" }],
      "UTC",
      false,
      now,
    ).text,
  ).toContain("Trial ends");
});
it("escapes injected content and folds whole Unicode characters", () => {
  expect(escapeIcs("a,b;c\nBEGIN:VEVENT")).toBe("a\\,b\\;c\\nBEGIN:VEVENT");
  for (const line of foldIcs("SUMMARY:" + "é".repeat(100)).split("\r\n"))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(
    exportIcs(
      [subscription()],
      "Pacific/Kiritimati",
      true,
      new Date("2026-01-30T12:00:00Z"),
    ).text,
  ).toContain("DTSTART;VALUE=DATE:20260131");
});
