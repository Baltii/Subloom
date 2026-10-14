import { describe, it, expect } from "vitest";
import {
  paymentSourceSchema,
  paymentProfileSchema,
  assignPaymentSource,
  removePaymentSource,
  sourceSummary,
} from "../../src/domain/payments";
import { subscription } from "../fixtures";
const source = paymentSourceSchema.parse({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  kind: "card",
  name: "Daily card",
  last4: "4242",
  expiryMonth: 10,
  expiryYear: 2026,
  updatedAt: "2026-10-12T12:00:00Z",
});
describe("payment source records", () => {
  it("rejects full card numbers, incomplete expiry and unknown sensitive fields", () => {
    expect(() =>
      paymentSourceSchema.parse({ ...source, last4: "4242424242424242" }),
    ).toThrow();
    expect(() =>
      paymentSourceSchema.parse({ ...source, name: "4242 4242 4242 4242" }),
    ).toThrow();
    expect(() =>
      paymentSourceSchema.parse({ ...source, expiryYear: null }),
    ).toThrow();
    expect(() =>
      paymentSourceSchema.parse({ ...source, cvv: "123" }),
    ).toThrow();
    expect(() =>
      paymentSourceSchema.parse({ ...source, kind: "wallet" }),
    ).toThrow();
  });
  it("keeps one link per subscription and unlinks removed sources", () => {
    const profile = assignPaymentSource(
      { sources: [source], links: [] },
      subscription().id,
      source.id,
      source.updatedAt,
    );
    expect(
      assignPaymentSource(
        profile,
        subscription().id,
        source.id,
        source.updatedAt,
      ).links,
    ).toHaveLength(1);
    expect(removePaymentSource(profile, source.id)).toEqual({
      sources: [],
      links: [],
    });
    expect(() =>
      paymentProfileSchema.parse({ ...profile, sources: [] }),
    ).toThrow();
  });
  it("keeps currencies separate, marks changed details for review, and treats expiry through the end of its month", () => {
    const second = subscription({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      currency: "TND",
      amountMinor: 1234,
    });
    const profile = {
      sources: [source],
      links: [subscription(), second].map((s) => ({
        subscriptionId: s.id,
        sourceId: source.id,
        reviewedAt: "2026-01-01T00:00:00Z",
      })),
    };
    const result = sourceSummary(
      profile,
      source,
      [subscription(), second],
      "2026-10-31",
    );
    expect(result.expires).toBe("soon");
    expect(result.review).toHaveLength(2);
    expect(result.totals.map((t) => t.currency)).toEqual(["USD", "TND"]);
    expect(
      sourceSummary(profile, source, [subscription()], "2026-11-01").expires,
    ).toBe("expired");
  });
  it("does not present canceled access-end dates as scheduled charges", () => {
    const s = subscription({ status: "canceled", paidThrough: "2026-11-01" });
    const profile = assignPaymentSource(
      { sources: [source], links: [] },
      s.id,
      source.id,
      source.updatedAt,
    );
    expect(sourceSummary(profile, source, [s], "2026-10-12").due).toEqual([]);
  });
});
