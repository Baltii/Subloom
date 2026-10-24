import { describe, expect, it } from "vitest";
import {
  trackedProSubscription,
  type ProTracking,
} from "../../src/domain/proTracking";
import { nextEvent } from "../../src/domain/renewal";
import { dueReminder } from "../../src/domain/reminders";
import { localReminderPlan } from "../../src/domain/localReminders";
import { emptySnapshot } from "../../src/domain/models";
import { preferences } from "../fixtures";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tracking: ProTracking = {
  id: "bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb",
  purchasedAt: "2026-01-24T23:30:00Z",
  periodEnd: "2026-01-31T23:30:00Z",
  anchorAt: "2026-01-31T23:30:00Z",
  trialEnd: "2026-01-31T23:30:00Z",
  canceledAt: null,
  endsAt: "2026-01-31T23:30:00Z",
  cancelAtPeriodEnd: false,
  status: "trialing",
  confirmed: true,
  interval: "month",
  amountMinor: 299,
  currency: "EUR",
};
const now = new Date("2026-01-28T08:00:00Z");
describe("confirmed Pro subscription tracking", () => {
  it("keeps trial purchase and billing dates in the account timezone without recording a charge", () => {
    const s = trackedProSubscription(
      tracking,
      "guest",
      owner,
      "Africa/Tunis",
      undefined,
      now,
    )!;
    expect(s).toMatchObject({
      serviceId: "subloom-pro",
      amountMinor: 299,
      currency: "EUR",
      status: "trial",
      startDate: "2026-01-25",
      trialEnd: "2026-02-01",
      nextRenewal: "2026-02-01",
      proBillingOwner: owner,
      paidThrough: null,
    });
    expect(nextEvent(s, "2026-01-28")).toEqual({
      type: "trial",
      date: "2026-02-01",
    });
  });
  it("uses annual price and the original month-end anchor after trial conversion", () => {
    const s = trackedProSubscription(
      {
        ...tracking,
        status: "active",
        interval: "year",
        amountMinor: 2400,
        periodEnd: "2027-01-31T23:30:00Z",
      },
      owner,
      owner,
      "UTC",
      undefined,
      now,
    )!;
    expect(s).toMatchObject({
      status: "active",
      interval: "yearly",
      amountMinor: 2400,
      nextRenewal: "2027-01-31",
      anchorDay: 31,
    });
    const monthly = trackedProSubscription(
      { ...tracking, status: "active", periodEnd: "2026-02-28T23:30:00Z" },
      owner,
      owner,
      "UTC",
      undefined,
      now,
    )!;
    expect(nextEvent(monthly, "2026-03-01")?.date).toBe("2026-03-31");
  });
  it("preserves reminder choices and notes; never adopts another billing owner", () => {
    const previous = trackedProSubscription(
      tracking,
      "guest",
      owner,
      "UTC",
      undefined,
      now,
    )!;
    previous.notes = "Keep my notes";
    previous.reminders = { enabled: false, days: [1] };
    const next = trackedProSubscription(
      { ...tracking, cancelAtPeriodEnd: true },
      "guest",
      owner,
      "UTC",
      previous,
      now,
    )!;
    expect(next.notes).toBe(previous.notes);
    expect(next.reminders).toEqual(previous.reminders);
    expect(
      trackedProSubscription(
        tracking,
        "guest",
        tracking.id,
        "UTC",
        previous,
        now,
      ),
    ).toBeNull();
  });
  it("creates no tracking entry for incomplete or unconfirmed payments", () => {
    expect(
      trackedProSubscription(
        { ...tracking, status: "incomplete", confirmed: false },
        "guest",
        owner,
        "UTC",
        undefined,
        now,
      ),
    ).toBeNull();
    expect(
      trackedProSubscription(
        { ...tracking, confirmed: false },
        "guest",
        owner,
        "UTC",
        undefined,
        now,
      ),
    ).toBeNull();
  });
  it("sends one access-ending reminder without a renewal amount after cancellation", () => {
    const s = trackedProSubscription(
      { ...tracking, cancelAtPeriodEnd: true, canceledAt: now.toISOString() },
      "guest",
      owner,
      "UTC",
      undefined,
      now,
    )!;
    const p = {
      ...preferences(),
      privacyMode: false,
      timezone: "UTC",
      reminderDays: [3],
      reminderHour: 9,
    };
    const at = new Date("2026-01-28T09:00:00Z");
    expect(dueReminder(s, p, at)?.kind).toBe("ending");
    const notifications = localReminderPlan(
      {
        ...emptySnapshot(),
        onboarded: true,
        preferences: p,
        subscriptions: [s],
      },
      now,
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toContain("plan ending");
    expect(notifications[0]?.body).toContain("Renewal is canceled");
    expect(notifications[0]?.body).not.toContain("2.99");
    expect(
      trackedProSubscription(
        { ...tracking, cancelAtPeriodEnd: true },
        "guest",
        owner,
        "UTC",
        s,
        new Date("2026-02-01"),
      )?.status,
    ).toBe("expired");
  });
});
