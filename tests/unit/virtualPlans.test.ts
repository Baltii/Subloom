import { it, expect } from "vitest";
import {
  simulateControl,
  issuingReadiness,
  type VirtualPlan,
} from "../../src/domain/virtualPlans";
import { userA } from "../fixtures";
const p: VirtualPlan = {
  subscriptionId: userA,
  currency: "GBP",
  monthlyCapMinor: 1000,
  desiredState: "allow",
  stopAfter: "2026-10-12",
};
it("simulates exact caps and a date-only trial stop without enabling issuance", () => {
  expect(issuingReadiness.enabled).toBe(false);
  expect(simulateControl(p, 500, 500, "GBP", "2026-10-12")).toContain(
    "Would allow",
  );
  expect(simulateControl(p, 500, 501, "GBP", "2026-10-12")).toContain(
    "cap exceeded",
  );
  expect(simulateControl(p, 0, 100, "GBP", "2026-10-13")).toContain(
    "stop date",
  );
});
it("never treats other currencies or a blocked plan as an allowed authorization", () => {
  expect(simulateControl(p, 0, 1, "EUR", "2026-10-12")).toContain(
    "unavailable",
  );
  expect(
    simulateControl({ ...p, desiredState: "block" }, 0, 1, "GBP", "2026-10-12"),
  ).toContain("blocked");
  expect(() => simulateControl(p, -1, 1, "GBP", "2026-10-12")).toThrow();
});
