import { z } from "zod";
import type { Subscription } from "./models";
import {
  cardBrands,
  walletProviders,
  paymentSourceSchema,
  paymentProfileSchema,
  type PaymentProfile,
  type PaymentSource,
} from "./payments";

// The existing subscription string travels atomically with the subscription and its outbox.
// A namespaced reference leaves older free-text billing notes intact.
export const unassignedBillingMethod = "billing:none";
export function billingReference(id: string) {
  return "billing:" + z.string().uuid().parse(id);
}
export function billingSourceId(value: string): string | null {
  if (!value.startsWith("billing:")) return null;
  const parsed = z.string().uuid().safeParse(value.slice(8));
  return parsed.success ? parsed.data : null;
}
export function subscriptionBillingValue(
  subscription: Subscription,
  profile: PaymentProfile,
): string {
  if (subscription.paymentMethod) return subscription.paymentMethod;
  const legacy = profile.links.find(
    (link) => link.subscriptionId === subscription.id,
  );
  return legacy ? billingReference(legacy.sourceId) : unassignedBillingMethod;
}
export function billingSource(
  subscription: Subscription,
  profile: PaymentProfile,
) {
  const id = billingSourceId(subscriptionBillingValue(subscription, profile));
  return profile.sources.find((source) => source.id === id);
}
export function billingMethodLabel(source: PaymentSource): string {
  const type =
    source.kind === "card"
      ? source.cardBrand || "Card"
      : source.kind === "wallet"
        ? source.walletProvider || "Wallet"
        : "Bank";
  const nickname = source.name === type ? "" : source.name + " · ";
  return (
    nickname +
    type +
    (source.kind === "card" && source.last4 ? " •••• " + source.last4 : "")
  );
}
export function subscriptionBillingLabel(
  subscription: Subscription,
  profile: PaymentProfile,
): string {
  const value = subscriptionBillingValue(subscription, profile);
  const source = billingSource(subscription, profile);
  if (source) return billingMethodLabel(source);
  if (value === unassignedBillingMethod) return "Not assigned";
  if (value.startsWith("billing:")) return "Billing method unavailable";
  return value;
}
export function matchesBillingFilter(
  subscription: Subscription,
  profile: PaymentProfile,
  filter: string,
): boolean {
  if (filter === "all") return true;
  const source = billingSource(subscription, profile);
  if (filter === "unassigned") return !source;
  if (filter === "cards") return source?.kind === "card";
  if (filter === "wallets") return source?.kind === "wallet";
  return source?.id === billingSourceId(filter);
}
export function mergeGuestBillingMethods(
  account: PaymentProfile,
  guest: PaymentProfile,
  importedSubscriptionIds: Set<string>,
): PaymentProfile {
  const known = new Set(account.sources.map((source) => source.id));
  const linked = new Set(account.links.map((link) => link.subscriptionId));
  return paymentProfileSchema.parse({
    sources: [
      ...account.sources,
      ...guest.sources.filter((source) => !known.has(source.id)),
    ],
    links: [
      ...account.links,
      ...guest.links.filter(
        (link) =>
          importedSubscriptionIds.has(link.subscriptionId) &&
          !linked.has(link.subscriptionId),
      ),
    ],
  });
}
export const billingMethodDraftSchema = z
  .object({
    kind: z.enum(["card", "wallet"]),
    cardBrand: z.enum(cardBrands),
    walletProvider: z.enum(walletProviders),
    last4: z.string(),
    nickname: z
      .string()
      .trim()
      .max(60)
      .refine(
        (value) => !/\d{12,}/.test(value.replace(/[ -]/g, "")),
        "Use a nickname, not an account or card number.",
      ),
  })
  .superRefine((value, context) => {
    if (value.kind === "card" && !/^\d{4}$/.test(value.last4))
      context.addIssue({
        code: "custom",
        path: ["last4"],
        message: "Enter exactly the last four digits.",
      });
  });
export type BillingMethodDraft = z.infer<typeof billingMethodDraftSchema>;
export function buildBillingMethod(
  draft: BillingMethodDraft,
  id: string,
  now: string,
  previous?: PaymentSource,
): PaymentSource {
  const value = billingMethodDraftSchema.parse(draft);
  return paymentSourceSchema.parse({
    id,
    kind: value.kind,
    name:
      value.nickname ||
      (value.kind === "card" ? value.cardBrand : value.walletProvider),
    cardBrand: value.kind === "card" ? value.cardBrand : null,
    walletProvider: value.kind === "wallet" ? value.walletProvider : null,
    last4: value.kind === "card" ? value.last4 : null,
    expiryMonth: value.kind === "card" ? (previous?.expiryMonth ?? null) : null,
    expiryYear: value.kind === "card" ? (previous?.expiryYear ?? null) : null,
    updatedAt: now,
  });
}
