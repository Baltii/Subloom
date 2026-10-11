import { describe, it, expect } from "vitest";
import { budgetsSchema, budgetProgress } from "../../src/domain/budgets";
import { subscription } from "../fixtures";
describe("category budgets", () => {
  it("keeps categories, currencies and inactive subscriptions separate", () => {
    const result = budgetProgress(
      [
        subscription({ amountMinor: 900 }),
        subscription({ currency: "EUR" }),
        subscription({ status: "canceled" }),
      ],
      [{ category: "Music", currency: "USD", limitMinor: 1000 }],
    );
    expect(result[0]).toMatchObject({
      spent: 900,
      remaining: 100,
      state: "near",
    });
  });
  it("alerts at the boundary, including zero-cost subscriptions", () => {
    expect(
      budgetProgress(
        [subscription({ amountMinor: 1000 })],
        [{ category: "Music", currency: "USD", limitMinor: 1000 }],
      )[0]?.state,
    ).toBe("over");
    expect(
      budgetProgress(
        [],
        [{ category: "Music", currency: "USD", limitMinor: 1 }],
      )[0]?.state,
    ).toBe("within");
  });
  it("rejects duplicate budgets and invalid limits", () => {
    const b = { category: "Music", currency: "USD", limitMinor: 1 };
    expect(budgetsSchema.safeParse([b, b]).success).toBe(false);
    expect(budgetsSchema.safeParse([{ ...b, limitMinor: 0 }]).success).toBe(
      false,
    );
  });
});
