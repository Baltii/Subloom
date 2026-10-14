import { z } from "zod";
import { currencies, dateSchema } from "./models";
import type { PaymentTransaction } from "./radar";
export const virtualPlanSchema = z
  .object({
    subscriptionId: z.string().uuid(),
    currency: z.enum(currencies),
    monthlyCapMinor: z.number().int().positive().max(1_000_000_000),
    desiredState: z.enum(["allow", "block"]),
    stopAfter: dateSchema.nullable(),
  })
  .strict();
export type VirtualPlan = z.infer<typeof virtualPlanSchema>;
export const virtualPlansSchema = z
  .array(virtualPlanSchema)
  .max(300)
  .refine(
    (rows) => new Set(rows.map((r) => r.subscriptionId)).size === rows.length,
    "Keep one card plan per subscription.",
  );
export const emptyVirtualPlans: VirtualPlan[] = [];
export const issuingReadiness = {
  enabled: false,
  audience: "personal consumers",
  markets: "Europe and UK",
  reason:
    "An approved consumer issuing partner is required. No cards are issued or payment controls enforced.",
} as const;
export function planHistory(
  plan: VirtualPlan,
  ledger: PaymentTransaction[],
  reference: string,
) {
  const month = reference.slice(0, 7);
  const history = ledger
    .filter(
      (t) =>
        !t.ignored &&
        t.subscriptionId === plan.subscriptionId &&
        t.currency === plan.currency,
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
  return {
    history,
    spentMinor: history
      .filter(
        (t) =>
          t.direction === "debit" &&
          t.date.startsWith(month) &&
          t.date <= reference,
      )
      .reduce((n, t) => n + t.amountMinor, 0),
    creditMinor: history
      .filter(
        (t) =>
          t.direction === "credit" &&
          t.date.startsWith(month) &&
          t.date <= reference,
      )
      .reduce((n, t) => n + t.amountMinor, 0),
  };
}
export function simulateControl(
  plan: VirtualPlan,
  spent: number,
  amount: number,
  currency: string,
  date: string,
) {
  virtualPlanSchema.parse(plan);
  dateSchema.parse(date);
  if (![spent, amount].every((v) => Number.isSafeInteger(v) && v >= 0))
    throw new Error("Use valid non-negative minor-unit amounts.");
  if (currency !== plan.currency)
    return "Currency differs; simulation unavailable";
  if (plan.desiredState === "block")
    return "Would decline: plan requests blocked authorizations";
  if (plan.stopAfter && date > plan.stopAfter)
    return "Would decline: planned stop date has passed";
  if (BigInt(spent) + BigInt(amount) > BigInt(plan.monthlyCapMinor))
    return "Would decline: planned monthly cap exceeded";
  return "Would allow under this plan; no payment authorization performed";
}
