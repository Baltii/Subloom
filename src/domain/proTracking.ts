import { z } from "zod";
import { subscriptionSchema, type Subscription } from "./models";
import { today } from "./renewal";

export const proTrackingSchema = z
  .object({
    id: z.string().uuid(),
    purchasedAt: z.string().datetime(),
    periodEnd: z.string().datetime(),
    anchorAt: z.string().datetime(),
    trialEnd: z.string().datetime().nullable(),
    canceledAt: z.string().datetime().nullable(),
    endsAt: z.string().datetime(),
    cancelAtPeriodEnd: z.boolean(),
    status: z.string(),
    confirmed: z.boolean(),
    interval: z.enum(["month", "year"]),
    amountMinor: z.union([z.literal(299), z.literal(2400)]),
    currency: z.literal("EUR"),
  })
  .refine((v) => v.amountMinor === (v.interval === "month" ? 299 : 2400));
export type ProTracking = z.infer<typeof proTrackingSchema>;

export function trackedProSubscription(
  tracking: ProTracking,
  workspace: string,
  owner: string,
  timezone: string,
  previous?: Subscription,
  now = new Date(),
): Subscription | null {
  if (previous?.proBillingOwner && previous.proBillingOwner !== owner)
    return null;
  if (
    !previous &&
    (!tracking.confirmed || !["active", "trialing"].includes(tracking.status))
  )
    return null;
  const date = (iso: string) => today(timezone, new Date(iso));
  const end = date(tracking.endsAt);
  const ending = tracking.cancelAtPeriodEnd || tracking.status === "canceled";
  const expired = ending && Date.parse(tracking.endsAt) <= now.getTime();
  const nextRenewal = ending
    ? end
    : date(
        tracking.status === "trialing" && tracking.trialEnd
          ? tracking.trialEnd
          : tracking.periodEnd,
      );
  const status: Subscription["status"] =
    expired || tracking.status === "incomplete_expired"
      ? "expired"
      : !tracking.confirmed && tracking.status !== "canceled"
        ? "paused"
        : ending
          ? "canceled"
          : tracking.status === "trialing"
            ? "trial"
            : tracking.status === "active" && tracking.confirmed
              ? "active"
              : "paused";
  return subscriptionSchema.parse({
    ...previous,
    id: tracking.id,
    userId: workspace,
    proBillingOwner: owner,
    serviceId: "subloom-pro",
    name: "Subloom Pro",
    category: "Productivity",
    amountMinor: tracking.amountMinor,
    currency: "EUR",
    interval: tracking.interval === "year" ? "yearly" : "monthly",
    intervalCount: 1,
    customUnit: "month",
    startDate: date(tracking.purchasedAt),
    nextRenewal,
    anchorDay: Number(date(tracking.anchorAt).slice(-2)),
    trialEnd: tracking.trialEnd ? date(tracking.trialEnd) : null,
    canceledAt: tracking.canceledAt ? date(tracking.canceledAt) : null,
    paidThrough: ending ? end : null,
    status,
    paymentMethod: previous?.paymentMethod ?? "",
    notes:
      previous?.notes ??
      "Added from your Subloom Pro purchase. Billing dates update automatically; your reminder choices stay yours.",
    source: previous?.source ?? "manual",
    reminders: previous?.reminders ?? null,
    createdAt: previous?.createdAt ?? tracking.purchasedAt,
    updatedAt: previous?.updatedAt ?? now.toISOString(),
    version: previous?.version ?? 0,
  });
}
