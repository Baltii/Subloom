import { it, expect } from "vitest";
import { subscription } from "../fixtures";
import {
  cancellationRecord,
  deadlineLabel,
  cancellationGuide,
} from "../../src/domain/cancellation";
it("requires a provider confirmation and preserves previous notes", () => {
  const s = subscription({ notes: "Existing note" });
  expect(() => cancellationRecord(s, "", null, "2026-10-11")).toThrow(
    /confirmation/,
  );
  expect(
    cancellationRecord(s, "EMAIL-123", "2026-11-01", "2026-10-11"),
  ).toMatchObject({
    status: "canceled",
    notes: "Existing note\nCancellation confirmed by you: EMAIL-123",
    paidThrough: "2026-11-01",
  });
  expect(() =>
    cancellationRecord(s, "REF", "2026-02-30", "2026-10-11"),
  ).toThrow();
  expect(s.status).toBe("active");
});
it("labels user deadlines and falls back safely for unknown merchants", () => {
  expect(deadlineLabel("2026-10-10", "2026-10-11")).toContain("passed");
  expect(deadlineLabel("2026-10-11", "2026-10-11")).toContain("today");
  expect(cancellationGuide(subscription({ serviceId: null }))).toBeNull();
  expect(cancellationGuide(subscription())).toMatch(
    /^https:\/\/www.spotify.com/,
  );
});
