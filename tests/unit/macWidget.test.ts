import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../../src/domain/models";
import { macWidgetPayload, widgetDays } from "../../src/domain/macWidget";
import { subscription } from "../fixtures";

const now = new Date("2026-10-17T12:00:00Z");
function snapshot() {
  return {
    ...emptySnapshot(),
    onboarded: true,
    preferences: {
      ...emptySnapshot().preferences,
      timezone: "Europe/Paris",
      privacyMode: false,
    },
  };
}
describe("Mac widget projection", () => {
  it("chooses the nearest date, prioritizes tied trial ends, and skips inactive/access-only records", () => {
    const data = snapshot();
    data.subscriptions = [
      subscription({ nextRenewal: "2026-10-20", name: "Renewal" }),
      subscription({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "trial",
        trialEnd: "2026-10-20",
        name: "Trial",
      }),
      ...(["paused", "expired", "canceled"] as const).map((status) =>
        subscription({
          status,
          nextRenewal: "2026-10-17",
          paidThrough: "2026-10-17",
        }),
      ),
    ];
    const result = macWidgetPayload(data, "guest", now);
    expect(result.entries[0]).toMatchObject({
      name: "Trial",
      kind: "trial",
      dueDate: "2026-10-20",
      days: 3,
    });
    expect(result.entries).toHaveLength(widgetDays);
  });
  it("advances while closed with the app's original month-end anchors", () => {
    const data = snapshot();
    data.subscriptions = [
      subscription({ nextRenewal: "2028-01-31", anchorDay: 31 }),
    ];
    const result = macWidgetPayload(
      data,
      "guest",
      new Date("2028-01-31T12:00:00Z"),
    );
    expect(result.entries[0]).toMatchObject({ dueDate: "2028-01-31", days: 0 });
    expect(result.entries[1]).toMatchObject({
      dueDate: "2028-02-29",
      days: 28,
    });
    expect(result.entries[30]).toMatchObject({ dueDate: "2028-03-31" });
  });
  it("uses account midnight across DST, with date-only countdowns", () => {
    const data = snapshot();
    data.subscriptions = [subscription({ nextRenewal: "2026-03-30" })];
    const result = macWidgetPayload(
      data,
      "guest",
      new Date("2026-03-28T23:30:00Z"),
    );
    expect(result.entries[0]).toMatchObject({ dueDate: "2026-03-30", days: 1 });
    expect(result.entries[1]!.at - result.entries[0]!.at).toBe(23 * 3600);
    expect(result.entries[1]!.days).toBe(0);
  });
  it("shares no service names, ids, prices, notes or outbox when private", () => {
    const data = snapshot();
    data.preferences.privacyMode = true;
    data.subscriptions = [
      subscription({ name: "Private merchant", notes: "private note" }),
    ];
    const result = macWidgetPayload(data, "guest", now);
    expect(result.entries[0]).toMatchObject({
      name: null,
      subscriptionId: null,
      kind: "renewal",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Private merchant|private note|amountMinor|outbox|aaaaaaaa/,
    );
  });
  it("keeps sample and pre-onboarding content out of the shared widget", () => {
    for (const flags of [{ demo: true }, { onboarded: false }]) {
      const data = { ...snapshot(), ...flags, subscriptions: [subscription()] };
      expect(
        macWidgetPayload(data, "guest", now).entries.every(
          (entry) => entry.kind === null,
        ),
      ).toBe(true);
    }
  });
});
