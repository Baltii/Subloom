import { z } from "zod";
import { dateSchema, type Subscription } from "./models";
import { catalog } from "./catalog";
import { daysBetween } from "./renewal";
export const cancellationSchema = z
  .record(
    z.string().uuid(),
    z.object({
      deadline: dateSchema,
      reviewedBilling: z.boolean(),
      openedProvider: z.boolean(),
      requested: z.boolean(),
    }),
  )
  .refine(
    (value) => Object.keys(value).length <= 500,
    "Keep at most 500 cancellation plans.",
  );
export function cancellationGuide(s: Subscription) {
  return (
    catalog.find((service) => service.id === s.serviceId)?.managementUrl ?? null
  );
}
export function deadlineLabel(deadline: string, reference: string) {
  const days = daysBetween(reference, deadline);
  return days < 0
    ? "Your target deadline has passed"
    : days === 0
      ? "Your target deadline is today"
      : days + " days until your target deadline";
}
export function cancellationRecord(
  s: Subscription,
  reference: string,
  paidThrough: string | null,
  now: string,
): Subscription {
  const ref = reference.trim();
  if (!ref)
    throw new Error(
      "Add a provider confirmation reference before recording cancellation.",
    );
  if (ref.length > 160)
    throw new Error("Keep the confirmation reference under 160 characters.");
  const note = "Cancellation confirmed by you: " + ref;
  return {
    ...s,
    status: "canceled",
    canceledAt: dateSchema.parse(now),
    paidThrough: paidThrough ? dateSchema.parse(paidThrough) : null,
    notes: [s.notes, note].filter(Boolean).join("\n"),
  };
}
