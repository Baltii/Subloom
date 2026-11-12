import { describe, expect, it } from "vitest";
import {
  renewalFromStart,
  subscriptionDateDefaults,
  subscriptionRenewalAnchor,
} from "../../src/domain/subscriptionDates";
import { advanceRenewal } from "../../src/domain/renewal";
import { subscription } from "../fixtures";

describe("subscription form dates", () => {
  it("starts today with a renewal one calendar month later", () => {
    expect(subscriptionDateDefaults({ reference: "2026-11-12" })).toEqual({
      startDate: "2026-11-12",
      nextRenewal: "2026-12-12",
      automaticRenewal: true,
    });
  });
  it("constrains month-end and leap-day renewals without using a fixed day count", () => {
    expect(
      renewalFromStart({ startDate: "2028-01-31", interval: "monthly" }),
    ).toBe("2028-02-29");
    expect(
      renewalFromStart({ startDate: "2027-01-31", interval: "monthly" }),
    ).toBe("2027-02-28");
    expect(
      renewalFromStart({ startDate: "2028-02-29", interval: "yearly" }),
    ).toBe("2029-02-28");
    expect(
      renewalFromStart({ startDate: "2026-11-30", interval: "quarterly" }),
    ).toBe("2027-02-28");
    expect(
      renewalFromStart({ startDate: "2026-12-29", interval: "weekly" }),
    ).toBe("2027-01-05");
  });
  it("preserves explicit calendar dates and saved schedules instead of resetting them on open", () => {
    expect(
      subscriptionDateDefaults({
        reference: "2026-11-12",
        defaultRenewalDate: "2026-12-25",
      }),
    ).toEqual({
      startDate: "2026-11-12",
      nextRenewal: "2026-12-25",
      automaticRenewal: false,
    });
    const initial = subscription({
      startDate: "2024-06-04",
      nextRenewal: "2026-12-20",
      intervalCount: 2,
    });
    expect(
      subscriptionDateDefaults({ reference: "2026-11-12", initial }),
    ).toEqual({
      startDate: "2024-06-04",
      nextRenewal: "2026-12-20",
      automaticRenewal: false,
    });
    expect(
      renewalFromStart({
        startDate: initial.startDate,
        interval: initial.interval,
        intervalCount: "2",
      }),
    ).toBe("2024-08-04");
  });
  it("ignores invalid query dates and waits for a valid schedule while typing", () => {
    expect(
      subscriptionDateDefaults({
        reference: "2026-11-12",
        defaultRenewalDate: "2026-02-30",
      }).nextRenewal,
    ).toBe("2026-12-12");
    expect(
      renewalFromStart({ startDate: "2026-11-", interval: "monthly" }),
    ).toBeNull();
    expect(
      renewalFromStart({ startDate: "2026-11-12", interval: "" }),
    ).toBeNull();
    expect(
      renewalFromStart({
        startDate: "2026-11-12",
        interval: "custom",
        intervalCount: "0",
      }),
    ).toBeNull();
  });
  it("supports custom periods and uses a valid trial end as the first charge", () => {
    expect(
      renewalFromStart({
        startDate: "2026-11-12",
        interval: "custom",
        intervalCount: "10",
        customUnit: "day",
      }),
    ).toBe("2026-11-22");
    expect(
      renewalFromStart({
        startDate: "2026-11-12",
        interval: "monthly",
        status: "trial",
        trialEnd: "2026-11-26",
      }),
    ).toBe("2026-11-26");
    expect(
      renewalFromStart({
        startDate: "2026-11-12",
        interval: "monthly",
        status: "trial",
        trialEnd: "2026-11-01",
      }),
    ).toBeNull();
  });

  it("restores the start day after a short month, and anchors trials to their first charge", () => {
    const monthly = subscription({
      startDate: "2027-01-31",
      nextRenewal: "2027-02-28",
    });
    monthly.anchorDay = subscriptionRenewalAnchor({
      ...monthly,
      automaticRenewal: true,
    });
    expect(advanceRenewal(monthly.nextRenewal, monthly)).toBe("2027-03-31");
    expect(
      subscriptionRenewalAnchor({
        ...monthly,
        status: "trial",
        automaticRenewal: true,
      }),
    ).toBe(28);
  });

  it("preserves a saved anchor and uses a manually chosen renewal day", () => {
    const initial = subscription({
      startDate: "2027-01-31",
      nextRenewal: "2027-02-28",
      anchorDay: 31,
    });
    expect(
      subscriptionRenewalAnchor({
        ...initial,
        automaticRenewal: false,
        initial,
      }),
    ).toBe(31);
    expect(
      subscriptionRenewalAnchor({
        ...initial,
        nextRenewal: "2027-02-20",
        automaticRenewal: false,
        initial,
      }),
    ).toBe(20);
  });
});
