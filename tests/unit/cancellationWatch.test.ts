import { describe, it, expect } from "vitest";
import {
  cancellationCases,
  cancellationEvidence,
} from "../../src/domain/cancellationWatch";
import { cancellationRecord } from "../../src/domain/cancellation";
import type { PaymentTransaction } from "../../src/domain/radar";
import { subscription } from "../fixtures";
const s = subscription({
  status: "canceled",
  canceledAt: "2026-09-01",
  paidThrough: "2026-09-30",
  notes: "Cancellation confirmed by you: CASE-123",
});
const t: PaymentTransaction = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  fingerprint: "b".repeat(64),
  date: "2026-10-01",
  merchant: "Spotify",
  amountMinor: 1099,
  currency: "USD",
  direction: "debit",
  sourceId: null,
  reference: "txn-1",
  subscriptionId: s.id,
  ignored: false,
  importedAt: "2026-10-12T12:00:00Z",
};
describe("cancellation watch", () => {
  it("requires user-recorded confirmation, matching, currency and a charge after the cutoff", () => {
    expect(cancellationCases([s], [t], [])).toHaveLength(1);
    for (const invalid of [
      { ...t, date: "2026-09-30" },
      { ...t, direction: "credit" as const },
      { ...t, currency: "EUR" as const },
      { ...t, subscriptionId: null },
      { ...t, ignored: true },
    ])
      expect(cancellationCases([s], [invalid], [])).toEqual([]);
    expect(cancellationCases([{ ...s, notes: "" }], [t], [])).toEqual([]);
    expect(cancellationCases([{ ...s, status: "active" }], [t], [])).toEqual(
      [],
    );
  });
  it("keeps original cancellation dates when adding missing confirmation", () => {
    expect(
      cancellationRecord(s, "NEW-REF", s.paidThrough, "2026-10-12").canceledAt,
    ).toBe("2026-09-01");
  });
  it("lists possible later credits without automatically resolving cases", () => {
    const credit = {
      ...t,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      direction: "credit" as const,
      date: "2026-10-03",
    };
    const entry = cancellationCases([s], [t, credit], [])[0]!;
    expect(entry.credits).toHaveLength(1);
    expect(entry.review).toBeNull();
    expect(cancellationEvidence(entry, "2026-10-12T12:00:00Z")).toContain(
      "No complaint or dispute was submitted",
    );
    expect(cancellationEvidence(entry, "2026-10-12T12:00:00Z")).toContain(
      "CASE-123",
    );
  });
});
