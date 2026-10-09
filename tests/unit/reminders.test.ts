import { describe, expect, it } from "vitest";
import {
  dueReminder,
  isQuiet,
  isHighRenewal,
} from "../../src/domain/reminders";
import { preferences, subscription } from "../fixtures";
describe("authoritative reminder plans", () => {
  it("flags only the configured currency without converting prices", () => {
    const p = {
      ...preferences(),
      currency: "USD" as const,
      highRenewalThresholdMinor: 2000,
    };
    expect(isHighRenewal(subscription({ amountMinor: 2000 }), p)).toBe(true);
    expect(isHighRenewal(subscription({ amountMinor: 1999 }), p)).toBe(false);
    expect(
      isHighRenewal(subscription({ amountMinor: 50000, currency: "TND" }), p),
    ).toBe(false);
    expect(
      isHighRenewal(subscription(), { ...p, highRenewalThresholdMinor: null }),
    ).toBe(false);
  });
  const s = subscription({ nextRenewal: "2026-10-10", anchorDay: 10 }),
    now = new Date("2026-10-09T10:00:00Z");
  it("generates deterministic event identity", () => {
    expect(dueReminder(s, preferences(), now)?.key).toBe(
      dueReminder(s, preferences(), now)?.key,
    );
    expect(dueReminder(s, preferences(), now)?.daysBefore).toBe(1);
  });
  it("invalidates identity when a subscription version changes", () =>
    expect(dueReminder({ ...s, version: 2 }, preferences(), now)?.key).not.toBe(
      dueReminder(s, preferences(), now)?.key,
    ));
  it("respects local reminder hour", () =>
    expect(
      dueReminder(s, preferences(), new Date("2026-10-09T08:59:00Z")),
    ).toBeNull());
  it("respects denied/off preferences", () =>
    expect(
      dueReminder(
        s,
        { ...preferences(), pushEnabled: false, emailEnabled: false },
        now,
      ),
    ).toBeNull());
  it("respects per-subscription overrides", () => {
    expect(
      dueReminder(
        { ...s, reminders: { enabled: false, days: [1] } },
        preferences(),
        now,
      ),
    ).toBeNull();
    expect(
      dueReminder(
        { ...s, reminders: { enabled: true, days: [3] } },
        preferences(),
        now,
      ),
    ).toBeNull();
  });
  it("does not alert for canceled paid-through access", () =>
    expect(
      dueReminder(
        { ...s, status: "canceled", paidThrough: "2026-10-10" },
        preferences(),
        now,
      ),
    ).toBeNull());
  it("supports overnight and same-day quiet hours", () => {
    expect(isQuiet(23, 22, 8)).toBe(true);
    expect(isQuiet(7, 22, 8)).toBe(true);
    expect(isQuiet(8, 22, 8)).toBe(false);
    expect(isQuiet(15, 14, 17)).toBe(true);
    expect(isQuiet(12, 0, 0)).toBe(false);
  });
  it("defers reminders inside quiet hours to the end", () => {
    const p = {
      ...preferences(),
      reminderHour: 7,
      quietStart: 22,
      quietEnd: 8,
    };
    expect(dueReminder(s, p, new Date("2026-10-09T07:30:00Z"))).toBeNull();
    expect(dueReminder(s, p, new Date("2026-10-09T08:00:00Z"))?.dueAt).toBe(
      "2026-10-09T08:00:00Z",
    );
  });
  it("handles spring daylight saving offsets at 9am", () => {
    const p = { ...preferences(), timezone: "America/New_York" },
      spring = subscription({ nextRenewal: "2026-03-09", anchorDay: 9 });
    expect(
      dueReminder(spring, p, new Date("2026-03-08T13:00:00Z"))?.dueAt,
    ).toBe("2026-03-08T13:00:00Z");
  });
  it("handles fall daylight saving offsets at 9am", () => {
    const p = { ...preferences(), timezone: "America/New_York" },
      fall = subscription({ nextRenewal: "2026-11-02", anchorDay: 2 });
    expect(dueReminder(fall, p, new Date("2026-11-01T14:00:00Z"))?.dueAt).toBe(
      "2026-11-01T14:00:00Z",
    );
  });
  it("honors trial reminder preference", () => {
    const trial = { ...s, status: "trial" as const, trialEnd: "2026-10-10" };
    expect(dueReminder(trial, preferences(), now)?.kind).toBe("trial");
    expect(
      dueReminder(trial, { ...preferences(), trialReminders: false }, now),
    ).toBeNull();
  });
});
