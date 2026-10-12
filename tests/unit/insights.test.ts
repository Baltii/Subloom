import { describe, expect, it } from "vitest";
import { subscription } from "../fixtures";
import { categorySpending, renewalForecast } from "../../src/domain/insights";
import { billingEvents } from "../../src/domain/schedule";

describe("dashboard insights", () => {
  it("keeps currencies separate and excludes inactive categories", () => {
    const rows = [
      subscription({ amountMinor: 1000 }),
      subscription({ currency: "EUR", amountMinor: 9999 }),
      subscription({ status: "paused", amountMinor: 9999 }),
    ];
    expect(categorySpending(rows, "USD")).toEqual([
      { category: "Music", amount: 1000, count: 1 },
    ]);
    expect(categorySpending(rows, "USD", "annual")[0]!.amount).toBe(12000);
  });
  it("aggregates fractional recurring costs before rounding a category", () => {
    const rows = [
      subscription({ amountMinor: 1, interval: "yearly" }),
      subscription({ amountMinor: 5, interval: "yearly" }),
    ];
    expect(categorySpending(rows, "USD")[0]!.amount).toBe(1);
  });
  it("counts anchored month-end renewals in a leap year", () => {
    const events = billingEvents(
      [subscription({ nextRenewal: "2028-01-31" })],
      "2028-01-01",
      "2028-04-01",
    );
    expect(events.map((e) => e.date)).toEqual([
      "2028-01-31",
      "2028-02-29",
      "2028-03-31",
    ]);
  });
  it("counts repeated weekly charges, using the remainder of the current month", () => {
    const rows = [
      subscription({
        interval: "weekly",
        nextRenewal: "2026-10-01",
        amountMinor: 100,
      }),
    ];
    const result = renewalForecast(rows, "USD", "2026-10-12");
    expect(result).toHaveLength(6);
    expect(result[0]!.events.map((e) => e.date)).toEqual([
      "2026-10-15",
      "2026-10-22",
      "2026-10-29",
    ]);
    expect(result[0]!.amount).toBe(300);
  });
  it("counts trial conversion once and excludes access-end events from charges", () => {
    const rows = [
      subscription({
        status: "trial",
        nextRenewal: "2026-10-20",
        trialEnd: "2026-10-20",
        anchorDay: 20,
        amountMinor: 500,
      }),
      subscription({
        status: "canceled",
        paidThrough: "2026-10-21",
        amountMinor: 800,
      }),
    ];
    const result = renewalForecast(rows, "USD", "2026-10-12");
    expect(result[0]!.amount).toBe(500);
    expect(result[0]!.events.map((e) => e.type)).toEqual(["trial"]);
    expect(
      billingEvents(rows, "2026-10-12", "2026-11-01").map((e) => e.type),
    ).toEqual(["trial", "paid_through"]);
  });
  it("does not project charges before a subscription starts or mutate records", () => {
    const row = subscription({
      startDate: "2026-11-01",
      nextRenewal: "2026-10-01",
    });
    const before = structuredClone(row);
    expect(billingEvents([row], "2026-10-01", "2026-11-01")).toEqual([]);
    expect(row).toEqual(before);
  });
  it("validates dates and bounds event generation", () => {
    expect(() => billingEvents([], "2026-02-30", "2026-03-01")).toThrow();
    expect(() => billingEvents([], "2026-01-01", "2028-01-01")).toThrow();
    const daily = Array.from({ length: 30 }, () =>
      subscription({
        interval: "custom",
        customUnit: "day",
        startDate: "2026-01-01",
        nextRenewal: "2026-01-01",
      }),
    );
    expect(() => billingEvents(daily, "2026-01-01", "2027-01-01")).toThrow(
      "Too many scheduled events",
    );
  });
});
