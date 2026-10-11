import { z } from "zod";
import { subscriptionSchema, type Subscription } from "./models";
export const workspaceSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(["family", "team"]),
});
export const memberSchema = z.object({
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
});
export const shareSchema = z.object({
  userId: z.string().uuid(),
  amountMinor: z.number().int().min(0).max(1_000_000_000),
});
export const sharedSubscriptionSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  data: subscriptionSchema,
  version: z.number().int().positive(),
  managed_by: z.string().uuid(),
  shares: z.array(shareSchema),
});
export function splitCost(amountMinor: number, userIds: string[]) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 0 ||
    !userIds.length ||
    new Set(userIds).size !== userIds.length
  )
    throw new Error("Choose unique participants and a valid price.");
  const base = Math.floor(amountMinor / userIds.length),
    remainder = amountMinor % userIds.length;
  return userIds.map((userId, index) =>
    shareSchema.parse({
      userId,
      amountMinor: base + (index < remainder ? 1 : 0),
    }),
  );
}
export function sharedCopy(s: Subscription, newId: string) {
  return {
    ...s,
    id: newId,
    notes: "",
    paymentMethod: "",
    reminders: null,
    source: "manual" as const,
    version: 1,
  };
}
