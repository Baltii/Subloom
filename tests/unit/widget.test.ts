import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../../src/domain/models";
import { widgetSnapshot } from "../../src/domain/widget";
import { preferences, subscription } from "../fixtures";
const now = new Date("2026-01-31T08:00:00Z");
function snapshot() {
  return {
    ...emptySnapshot(),
    onboarded: true,
    preferences: { ...preferences(), privacyMode: false },
    subscriptions: [subscription()],
  };
}
describe("next subscription widget", () => {
  it("shows today's renewal in its original currency without notification consent", () => {
    const data = snapshot();
    data.preferences.emailEnabled = false;
    data.preferences.pushEnabled = false;
    const plan = widgetSnapshot(data, false, now);
    expect(plan.mode).toBe("ready");
    expect(plan.entries[0]).toMatchObject({
      name: "Spotify",
      label: "Renews",
      date: "2026-01-31",
      amount: "$10.99",
      path: `/subscription/${subscription().id}`,
    });
  });
  it("advances closed-app timelines across month-end renewals", () => {
    const plan = widgetSnapshot(snapshot(), false, now);
    expect(plan.entries.slice(0, 3).map((e) => [e.from, e.date])).toEqual([
      [Date.parse("2026-01-31T00:00:00Z"), "2026-01-31"],
      [Date.parse("2026-02-01T00:00:00Z"), "2026-02-28"],
      [Date.parse("2026-03-01T00:00:00Z"), "2026-03-31"],
    ]);
    expect(plan.expiresAt).toBe(Date.parse("2026-05-01T00:00:00Z"));
  });
  it("chooses the nearest event and prioritizes a trial deadline on tied dates", () => {
    const data = snapshot();
    data.subscriptions.push(
      subscription({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Design",
        status: "trial",
        trialEnd: "2026-01-31",
      }),
    );
    const plan = widgetSnapshot(data, false, now);
    expect(plan.entries[0]).toMatchObject({
      name: "Design",
      label: "Trial ends",
      date: "2026-01-31",
    });
    expect(plan.entries[1]?.name).toBe("Spotify");
  });
  it("does not show paused, expired or canceled renewals", () => {
    for (const status of ["paused", "expired", "canceled"] as const) {
      const data = snapshot();
      data.subscriptions = [
        subscription({ status, paidThrough: "2026-02-15" }),
      ];
      expect(widgetSnapshot(data, false, now).entries[0]).toMatchObject({
        name: "All clear",
        date: "",
        path: "/",
      });
    }
  });
  it("stores no subscription details under privacy mode or app protection", () => {
    const data = snapshot();
    for (const protectedApp of [false, true]) {
      data.preferences.privacyMode = !protectedApp;
      const plan = widgetSnapshot(data, protectedApp, now);
      expect(plan.mode).toBe("private");
      expect(plan.entries).toEqual([]);
      expect(JSON.stringify(plan)).not.toMatch(/Spotify|10\.99|aaaaaaaa/);
    }
  });
  it("does not publish demo data, an unhydrated workspace or onboarding content", () => {
    expect(widgetSnapshot(null, false, now).mode).toBe("setup");
    for (const data of [
      { ...snapshot(), demo: true },
      { ...snapshot(), onboarded: false },
    ]) {
      expect(widgetSnapshot(data, false, now)).toMatchObject({
        mode: "setup",
        entries: [],
      });
    }
  });
  it("uses the workspace timezone for today and midnight transitions across DST", () => {
    const data = snapshot();
    data.preferences.timezone = "America/New_York";
    data.subscriptions = [
      subscription({
        interval: "custom",
        customUnit: "day",
        nextRenewal: "2026-03-07",
      }),
    ];
    const plan = widgetSnapshot(data, false, new Date("2026-03-08T01:00:00Z"));
    expect(plan.entries[0]?.date).toBe("2026-03-07");
    expect(plan.entries.slice(0, 3).map((e) => e.from)).toEqual([
      Date.parse("2026-03-07T05:00:00Z"),
      Date.parse("2026-03-08T05:00:00Z"),
      Date.parse("2026-03-09T04:00:00Z"),
    ]);
    expect(plan.entries).toHaveLength(90);
  });
  it("preserves zero and three decimal currency formatting", () => {
    const data = snapshot();
    data.subscriptions = [
      subscription({ currency: "TND", amountMinor: 12345 }),
    ];
    expect(widgetSnapshot(data, false, now).entries[0]?.amount).toContain(
      "12.345",
    );
    data.subscriptions = [subscription({ currency: "JPY", amountMinor: 1000 })];
    expect(widgetSnapshot(data, false, now).entries[0]?.amount).toContain(
      "1,000",
    );
  });
});
