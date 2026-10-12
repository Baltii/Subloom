import { describe, expect, it } from "vitest";
import { subscription } from "../fixtures";
import {
  monthEvents,
  quickAddDates,
  scheduledCharges,
} from "../../src/domain/calendarEvents";

describe("subscription calendar", () => {
  it("shows anchored repeats and starts within the selected month", () => {
    const row = subscription({
      startDate: "2028-02-01",
      nextRenewal: "2028-02-29",
      anchorDay: 31,
    });
    const events = monthEvents([row], "2028-02-01");
    expect(events.map((event) => [event.date, event.type])).toEqual([
      ["2028-02-01", "start"],
      ["2028-02-29", "renewal"],
    ]);
    expect(monthEvents([row], "2028-03-01")[0]!.date).toBe("2028-03-31");
  });
  it("includes saved cancellation targets only for matching live subscriptions", () => {
    const row = subscription();
    const plans = {
      [row.id]: {
        deadline: "2026-10-15",
        requested: false,
        openedProvider: false,
        reviewedBilling: false,
      },
      "missing-id": {
        deadline: "2026-10-16",
        requested: false,
        openedProvider: false,
        reviewedBilling: false,
      },
    };
    expect(
      monthEvents([row], "2026-10-01", plans).filter(
        (event) => event.type === "deadline",
      ),
    ).toHaveLength(1);
    expect(
      monthEvents(
        [subscription({ status: "canceled" })],
        "2026-10-01",
        plans,
      ).filter((event) => event.type === "deadline"),
    ).toEqual([]);
    expect(
      monthEvents([row], "2026-11-01", plans).filter(
        (event) => event.type === "deadline",
      ),
    ).toEqual([]);
  });
  it("keeps access endings and subscription starts out of mixed-currency charge totals", () => {
    const rows = [
      subscription({
        amountMinor: 100,
        currency: "USD",
        startDate: "2026-10-01",
      }),
      subscription({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        amountMinor: 300,
        currency: "EUR",
      }),
      subscription({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "canceled",
        paidThrough: "2026-10-10",
        amountMinor: 900,
      }),
    ];
    expect(scheduledCharges(monthEvents(rows, "2026-10-01"))).toEqual([
      { currency: "EUR", amount: 300 },
      { currency: "USD", amount: 100 },
    ]);
  });
  it("excludes paused renewals and expired access while preserving active trials", () => {
    const rows = [
      subscription({ status: "paused" }),
      subscription({ status: "expired" }),
      subscription({
        status: "trial",
        trialEnd: "2026-10-20",
        nextRenewal: "2026-10-20",
        anchorDay: 20,
      }),
    ];
    expect(monthEvents(rows, "2026-10-01").map((event) => event.type)).toEqual([
      "trial",
    ]);
  });
  it("prefills clicked dates without changing guest or account record fields", () => {
    expect(quickAddDates("2026-12-31", "2026-10-12")).toEqual({
      nextRenewal: "2026-12-31",
      startDate: "2026-10-12",
    });
    expect(quickAddDates("2026-09-30", "2026-10-12")).toEqual({
      nextRenewal: "2026-09-30",
      startDate: "2026-09-30",
    });
  });
  it("rejects impossible dates, repeated query values and injection-shaped input", () => {
    for (const value of [
      "2026-02-30",
      ["2026-10-20", "2026-10-21"],
      "<script>alert(1)</script>",
      undefined,
    ])
      expect(quickAddDates(value, "2026-10-12").nextRenewal).toBe("2026-10-12");
  });
});
