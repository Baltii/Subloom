import { describe, expect, it } from "vitest";
import { browserRenewals } from "../../src/domain/browserRenewals";
import { preferences, subscription } from "../fixtures";

describe("browser renewal overview", () => {
  it("uses the workspace's Sunday and includes repeated charges through that day", () => {
    const view = browserRenewals(
      {
        preferences: { ...preferences(), timezone: "America/New_York" },
        subscriptions: [
          subscription({ interval: "custom", customUnit: "day" }),
          subscription({ status: "canceled", paidThrough: "2026-02-01" }),
          subscription({ status: "paused" }),
        ],
      },
      new Date("2026-02-01T02:00:00Z"),
    );

    expect(view.weekLabel).toBe("Jan 26 – Feb 1");
    expect(view.next).toMatchObject({ days: 0, amount: "$10.99" });
    expect(view.week.map(({ days }) => days)).toEqual([0, 1]);
  });

  it("keeps a later trial ending visible when the current week is clear", () => {
    const view = browserRenewals(
      {
        preferences: preferences(),
        subscriptions: [
          subscription({ status: "trial", trialEnd: "2026-02-02" }),
        ],
      },
      new Date("2026-02-01T10:00:00Z"),
    );

    expect(view.week).toEqual([]);
    expect(view.next).toMatchObject({ type: "trial", days: 1 });
  });
});
