import { z } from "zod";
import { currencies, dateSchema, type Subscription } from "./models";
import { daysBetween, nextEvent, hasAnnualCadence } from "./renewal";
import type { PaymentTransaction } from "./radar";
export const autopilotRuleSchema = z
  .object({
    subscriptionId: z.string().uuid(),
    askAnnual: z.boolean(),
    warnIncrease: z.boolean(),
    baselineMinor: z.number().int().min(0).max(1_000_000_000),
    currency: z.enum(currencies),
    limitMinor: z.number().int().min(0).max(1_000_000_000).nullable(),
    leadDays: z.number().int().min(0).max(30),
    revision: z.string().uuid(),
    baselineDate: dateSchema,
    decision: z
      .object({
        key: z.string().max(300),
        outcome: z.enum(["reviewed", "provider_confirmed"]),
        reference: z.string().trim().max(160),
        recordedAt: z.string().datetime(),
      })
      .nullable(),
  })
  .strict();
export const autopilotSchema = z
  .array(autopilotRuleSchema)
  .max(300)
  .refine(
    (rows) => new Set(rows.map((r) => r.subscriptionId)).size === rows.length,
    "Keep one rule per subscription.",
  );
export type AutopilotRule = z.infer<typeof autopilotRuleSchema>;
export const emptyAutopilot: AutopilotRule[] = [];
export function evaluateRule(
  s: Subscription,
  rule: AutopilotRule,
  reference: string,
  ledger: PaymentTransaction[],
) {
  const event = nextEvent(s, reference);
  if (!event || event.type === "paid_through") return null;
  const latest = ledger
    .filter(
      (t) =>
        t.subscriptionId === s.id &&
        t.currency === s.currency &&
        !t.ignored &&
        t.direction === "debit" &&
        t.date >= rule.baselineDate &&
        t.date <= reference,
    )
    .toSorted((a, b) => b.date.localeCompare(a.date))[0];
  const changedCurrency = s.currency !== rule.currency;
  const annual = hasAnnualCadence(s);
  const increased =
    !changedCurrency &&
    (s.amountMinor > rule.baselineMinor ||
      (latest?.amountMinor ?? 0) > rule.baselineMinor);
  const limitExceeded =
    !changedCurrency &&
    rule.limitMinor !== null &&
    s.amountMinor > rule.limitMinor;
  const reasons = [
    changedCurrency ? "Currency changed; review the rule and its limit" : null,
    rule.askAnnual && annual ? "Annual renewal needs your review" : null,
    rule.warnIncrease && increased
      ? "Recorded price or imported charge exceeds your baseline"
      : null,
    limitExceeded ? "Expected price exceeds your approved limit" : null,
  ].filter((v): v is string => Boolean(v));
  const key = [
    s.id,
    event.date,
    s.currency,
    s.amountMinor,
    latest?.id ?? "",
    latest?.amountMinor ?? "",
    rule.revision,
  ].join(":");
  return {
    event,
    key,
    reasons,
    latest,
    changedCurrency,
    limitExceeded,
    due: daysBetween(reference, event.date) <= rule.leadDays,
    reviewed: rule.decision?.key === key,
  };
}
