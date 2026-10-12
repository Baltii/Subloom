import { it, expect } from "vitest";
import { userA, userB, subscription } from "../fixtures";
import { splitCost, sharedCopy } from "../../src/domain/workspaces";
it("allocates every minor unit and rejects duplicate members", () => {
  expect(splitCost(1099, [userA, userB]).map((s) => s.amountMinor)).toEqual([
    550, 549,
  ]);
  expect(() => splitCost(1, [userA, userA])).toThrow();
});
it("strips personal notes and payment data from explicitly shared copies", () => {
  expect(
    sharedCopy(
      subscription({ notes: "private", paymentMethod: "personal card" }),
      userB,
    ),
  ).toMatchObject({
    id: userB,
    notes: "",
    paymentMethod: "",
    reminders: null,
    source: "manual",
  });
});
