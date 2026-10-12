import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../../src/domain/models";
import { localReminderPlan } from "../../src/domain/localReminders";
import { subscription, preferences } from "../fixtures";
function snapshot() {
  return {
    ...emptySnapshot(),
    onboarded: true,
    subscriptions: [subscription()],
    preferences: {
      ...preferences(),
      reminderDays: [0],
      reminderHour: 9,
      quietStart: 22,
      quietEnd: 7,
      privacyMode: false,
    },
  };
}
const now = new Date("2026-01-31T08:00:00Z");
describe("Mac local reminder planning", () => {
  it("schedules guest renewals without email or mobile push consent", () => {
    const data = snapshot();
    data.preferences.emailEnabled = false;
    const plan = localReminderPlan(data, now);
    expect(plan[0]?.at).toBe("2026-01-31T09:00:00Z");
    expect(plan[1]?.at).toBe("2026-02-28T09:00:00Z");
    expect(plan[2]?.at).toBe("2026-03-31T09:00:00Z");
    expect(plan[0]?.path).toBe("/subscription/" + subscription().id);
  });
  it("skips past alerts and sample or uninitialized workspaces", () => {
    expect(
      localReminderPlan(snapshot(), new Date("2026-01-31T10:00:00Z"))[0]?.at,
    ).toBe("2026-02-28T09:00:00Z");
    expect(localReminderPlan({ ...snapshot(), demo: true }, now)).toEqual([]);
    expect(localReminderPlan({ ...snapshot(), onboarded: false }, now)).toEqual(
      [],
    );
  });
  it("uses per-subscription offsets and deduplicates them", () => {
    const data = snapshot();
    data.subscriptions = [
      subscription({ reminders: { enabled: true, days: [1, 1] } }),
    ];
    const plan = localReminderPlan(data, now);
    expect(plan[0]?.at).toBe("2026-02-27T09:00:00Z");
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
  it("omits disabled, paused and canceled subscriptions", () => {
    for (const overrides of [
      { reminders: { enabled: false, days: [0] } },
      { status: "paused" as const },
      { status: "canceled" as const, paidThrough: "2026-02-28" },
    ]) {
      expect(
        localReminderPlan(
          { ...snapshot(), subscriptions: [subscription(overrides)] },
          now,
        ),
      ).toEqual([]);
    }
  });
  it("keeps trials optional and schedules later renewals", () => {
    const data = snapshot();
    data.subscriptions = [
      subscription({
        status: "trial",
        trialEnd: "2026-02-03",
        nextRenewal: "2026-02-03",
        anchorDay: 3,
      }),
    ];
    expect(localReminderPlan(data, now)[0]?.title).toContain("trial ending");
    data.preferences.trialReminders = false;
    const plan = localReminderPlan(data, now);
    expect(plan.every((p) => !p.title.includes("trial ending"))).toBe(true);
    expect(plan.length).toBeGreaterThan(0);
  });
  it("hides subscription details in privacy mode", () => {
    const data = snapshot();
    data.preferences.privacyMode = true;
    const plan = localReminderPlan(data, now);
    expect(plan[0]?.title).toBe("Subloom reminder");
    expect(plan[0]?.body).not.toMatch(/Spotify|10.99|USD/);
  });
  it("defers an evening alert across overnight quiet hours", () => {
    const data = snapshot();
    data.preferences.reminderHour = 23;
    expect(localReminderPlan(data, now)[0]?.at).toBe("2026-02-01T07:00:00Z");
    data.preferences.reminderHour = 6;
    expect(
      localReminderPlan(data, new Date("2026-01-31T05:00:00Z"))[0]?.at,
    ).toBe("2026-01-31T07:00:00Z");
  });
  it("resolves timezone DST and retains only the nearest 48 alerts", () => {
    const data = snapshot();
    data.preferences.timezone = "America/New_York";
    data.subscriptions = [
      subscription({
        interval: "custom",
        customUnit: "day",
        startDate: "2026-03-07",
        nextRenewal: "2026-03-07",
      }),
    ];
    const plan = localReminderPlan(data, new Date("2026-03-07T12:00:00Z"));
    expect(plan[0]?.at).toBe("2026-03-07T14:00:00Z");
    expect(plan[1]?.at).toBe("2026-03-08T13:00:00Z");
    expect(plan).toHaveLength(48);
    expect(plan.map((p) => p.at)).toEqual(plan.map((p) => p.at).sort());
  });
});
