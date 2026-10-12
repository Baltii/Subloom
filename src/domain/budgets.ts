import { z } from "zod";
import { categories, currencies, type Subscription } from "./models";
import { recurringTotals } from "./money";
export const budgetsSchema = z
  .array(
    z.object({
      category: z.enum(categories),
      currency: z.enum(currencies),
      limitMinor: z.number().int().positive().max(1_000_000_000),
    }),
  )
  .max(70)
  .refine(
    (rows) =>
      new Set(rows.map((r) => r.category + r.currency)).size === rows.length,
    "Each category and currency needs one budget.",
  );
export function budgetProgress(
  subscriptions: Subscription[],
  budgets: z.infer<typeof budgetsSchema>,
) {
  return budgets.map((budget) => {
    const spent =
      recurringTotals(
        subscriptions.filter((s) => s.category === budget.category),
      ).find((t) => t.currency === budget.currency)?.monthly ?? 0;
    return {
      ...budget,
      spent,
      remaining: budget.limitMinor - spent,
      state:
        spent >= budget.limitMinor
          ? "over"
          : spent * 10 >= budget.limitMinor * 8
            ? "near"
            : "within",
    };
  });
}
