import { z } from "zod";
import { currencies, type Subscription } from "./models";
import { recurringTotals } from "./money";
import { nextEvent } from "./renewal";

export const cardBrands = [
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
  "UnionPay",
  "JCB",
  "Diners Club",
  "Other card",
] as const;
export const walletProviders = [
  "Apple Wallet",
  "Google Wallet",
  "RedotPay",
  "Crypto wallet",
  "PayPal",
  "Other wallet",
] as const;

export const paymentSourceSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["card", "bank", "wallet"]),
    name: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine(
        (v) => !/\d{12,}/.test(v.replace(/[ -]/g, "")),
        "Use a nickname, not a full account or card number.",
      ),
    last4: z
      .string()
      .regex(/^\d{4}$/)
      .nullable(),
    cardBrand: z.enum(cardBrands).nullable().optional(),
    walletProvider: z.enum(walletProviders).nullable().optional(),
    expiryMonth: z.number().int().min(1).max(12).nullable(),
    expiryYear: z.number().int().min(2020).max(2100).nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.cardBrand && value.kind !== "card") ||
      (value.walletProvider && value.kind !== "wallet")
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose a type that matches this billing method.",
      });
    if ((value.expiryMonth === null) !== (value.expiryYear === null))
      ctx.addIssue({
        code: "custom",
        message: "Supply both expiry month and year, or leave both empty.",
      });
    if (
      value.kind !== "card" &&
      (value.expiryMonth !== null || value.last4 !== null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Only cards store last four digits and expiry.",
      });
  });
export type PaymentSource = z.infer<typeof paymentSourceSchema>;
export const paymentProfileSchema = z
  .object({
    sources: z.array(paymentSourceSchema).max(50),
    links: z
      .array(
        z
          .object({
            subscriptionId: z.string().uuid(),
            sourceId: z.string().uuid(),
            reviewedAt: z.string().datetime(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set(value.sources.map((s) => s.id));
    if (
      ids.size !== value.sources.length ||
      new Set(value.links.map((l) => l.subscriptionId)).size !==
        value.links.length ||
      value.links.some((l) => !ids.has(l.sourceId))
    )
      ctx.addIssue({
        code: "custom",
        message: "Each subscription must link to one existing payment source.",
      });
  });
export type PaymentProfile = z.infer<typeof paymentProfileSchema>;
export const emptyPaymentProfile: PaymentProfile = { sources: [], links: [] };
export function assignPaymentSource(
  profile: PaymentProfile,
  subscriptionId: string,
  sourceId: string | null,
  now: string,
): PaymentProfile {
  return paymentProfileSchema.parse({
    ...profile,
    links: [
      ...profile.links.filter((l) => l.subscriptionId !== subscriptionId),
      ...(sourceId ? [{ subscriptionId, sourceId, reviewedAt: now }] : []),
    ],
  });
}
export function removePaymentSource(
  profile: PaymentProfile,
  id: string,
): PaymentProfile {
  return {
    sources: profile.sources.filter((s) => s.id !== id),
    links: profile.links.filter((l) => l.sourceId !== id),
  };
}
export function sourceSummary(
  profile: PaymentProfile,
  source: PaymentSource,
  subscriptions: Subscription[],
  reference: string,
) {
  const links = new Map(
    profile.links
      .filter((l) => l.sourceId === source.id)
      .map((l) => [l.subscriptionId, l]),
  );
  const linked = subscriptions.filter((s) => links.has(s.id));
  const due = linked
    .flatMap((s) => {
      const event = nextEvent(s, reference);
      return event && event.type !== "paid_through"
        ? [{ subscription: s, date: event.date, type: event.type }]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const month = Number(reference.slice(5, 7)),
    year = Number(reference.slice(0, 4));
  const expires =
    source.expiryYear === null
      ? "unknown"
      : source.expiryYear < year ||
          (source.expiryYear === year && source.expiryMonth! < month)
        ? "expired"
        : (source.expiryYear - year) * 12 + source.expiryMonth! - month <= 2
          ? "soon"
          : "valid";
  const review = linked.filter(
    (s) => links.get(s.id)!.reviewedAt < source.updatedAt,
  );
  return { linked, due, totals: recurringTotals(linked), expires, review };
}
export const currencyOptions = currencies.map((value) => ({
  value,
  label: value,
}));
