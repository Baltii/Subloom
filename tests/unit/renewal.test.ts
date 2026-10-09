import { describe, expect, it } from "vitest";
import {
  advanceRenewal,
  daysBetween,
  nextEvent,
  today,
  upcoming,
} from "../../src/domain/renewal";
import { dateSchema } from "../../src/domain/models";
import { subscription } from "../fixtures";
describe("calendar billing anchors", () => {
  it("clamps January 31 then restores March 31", () => {
    const s = subscription();
    const feb = advanceRenewal("2026-01-31", s);
    expect(feb).toBe("2026-02-28");
    expect(advanceRenewal(feb, s)).toBe("2026-03-31");
  });
  it("handles leap-year February", () =>
    expect(advanceRenewal("2024-01-31", subscription())).toBe("2024-02-29"));
  it("restores annual leap-day anchors", () => {
    const s = subscription({ interval: "yearly", anchorDay: 29 });
    expect(advanceRenewal("2024-02-29", s)).toBe("2025-02-28");
    expect(advanceRenewal("2025-02-28", s, 3)).toBe("2028-02-29");
  });
  it("crosses year boundaries and handles quarterly intervals", () => {
    expect(advanceRenewal("2026-12-31", subscription())).toBe("2027-01-31");
    expect(
      advanceRenewal(
        "2026-11-30",
        subscription({ interval: "quarterly", anchorDay: 30 }),
      ),
    ).toBe("2027-02-28");
  });
  it.each([
    ["day", 10, "2026-02-10"],
    ["week", 2, "2026-02-14"],
    ["month", 2, "2026-03-31"],
    ["year", 2, "2028-01-31"],
  ] as const)("handles custom %s", (customUnit, intervalCount, expected) =>
    expect(
      advanceRenewal(
        "2026-01-31",
        subscription({ interval: "custom", customUnit, intervalCount }),
      ),
    ).toBe(expected),
  );
  it("projects stale recurrence without modifying its anchor", () =>
    expect(nextEvent(subscription(), "2026-10-09")?.date).toBe("2026-10-31"));
  it("handles very old daily recurrence without a fixed iteration cap", () =>
    expect(
      nextEvent(
        subscription({
          interval: "custom",
          customUnit: "day",
          intervalCount: 1,
          nextRenewal: "2001-01-01",
        }),
        "2026-10-09",
      )?.date,
    ).toBe("2026-10-09"));
  it("honors a manual renewal override", () =>
    expect(
      nextEvent(
        subscription({ nextRenewal: "2026-10-15", anchorDay: 15 }),
        "2026-10-09",
      )?.date,
    ).toBe("2026-10-15"));
  it("shows trial expiry before paid renewals", () =>
    expect(
      nextEvent(
        subscription({
          status: "trial",
          trialEnd: "2026-10-12",
          nextRenewal: "2026-10-12",
          anchorDay: 12,
        }),
        "2026-10-09",
      ),
    ).toEqual({ date: "2026-10-12", type: "trial" }));
  it("handles canceled access through a paid-through date", () => {
    const s = subscription({ status: "canceled", paidThrough: "2026-10-15" });
    expect(nextEvent(s, "2026-10-09")?.type).toBe("paid_through");
    expect(nextEvent(s, "2026-10-16")).toBeNull();
  });
  it.each(["paused", "expired"] as const)("excludes %s", (status) =>
    expect(nextEvent(subscription({ status }), "2026-10-09")).toBeNull(),
  );
  it("calculates dates by timezone across midnight", () => {
    const now = new Date("2026-10-09T01:00:00Z");
    expect(today("America/Los_Angeles", now)).toBe("2026-10-08");
    expect(today("Asia/Tokyo", now)).toBe("2026-10-09");
  });
  it("uses calendar days across DST", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });
  it("rejects impossible dates instead of normalizing them", () => {
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
  });
  it("sorts events chronologically", () =>
    expect(
      upcoming(
        [
          subscription({ id: "a", nextRenewal: "2026-10-15" }),
          subscription({ id: "b", nextRenewal: "2026-10-10" }),
        ],
        "UTC",
        new Date("2026-10-09T00:00:00Z"),
      )[0]?.subscription.id,
    ).toBe("b"));
});
