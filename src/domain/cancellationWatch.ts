import { z } from "zod";
import type { Subscription } from "./models";
import type { PaymentTransaction } from "./radar";
import { daysBetween } from "./renewal";
import { formatMoney } from "./money";
export const watchStatuses = [
  "open",
  "contacted",
  "resolved",
  "expected",
] as const;
export const watchReviewSchema = z
  .object({
    transactionId: z.string().uuid(),
    status: z.enum(watchStatuses),
    note: z.string().trim().max(300),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const watchReviewsSchema = z
  .array(watchReviewSchema)
  .max(300)
  .refine(
    (rows) => new Set(rows.map((r) => r.transactionId)).size === rows.length,
    "Each transaction has one review.",
  );
export type WatchReview = z.infer<typeof watchReviewSchema>;
export const emptyWatchReviews: WatchReview[] = [];
export function providerConfirmation(s: Subscription) {
  const lines = s.notes
    .split("\n")
    .filter((line) => line.startsWith("Cancellation confirmed by you: "));
  return (
    lines
      .at(-1)
      ?.slice("Cancellation confirmed by you: ".length)
      .trim()
      .slice(0, 160) || null
  );
}
export function cancellationCases(
  subscriptions: Subscription[],
  transactions: PaymentTransaction[],
  reviews: WatchReview[],
) {
  const grouped = new Map<string, PaymentTransaction[]>(),
    reviewed = new Map(reviews.map((r) => [r.transactionId, r]));
  for (const t of transactions)
    if (t.subscriptionId && !t.ignored) {
      const group = grouped.get(t.subscriptionId) ?? [];
      group.push(t);
      grouped.set(t.subscriptionId, group);
    }
  return subscriptions
    .flatMap((s) => {
      const confirmation = providerConfirmation(s);
      if (s.status !== "canceled" || !s.canceledAt || !confirmation) return [];
      const cutoff =
        s.paidThrough && s.paidThrough > s.canceledAt
          ? s.paidThrough
          : s.canceledAt;
      const rows = (grouped.get(s.id) ?? []).filter(
          (t) => t.currency === s.currency,
        ),
        credits = rows.filter((t) => t.direction === "credit");
      return rows
        .filter((t) => t.direction === "debit" && t.date > cutoff)
        .map((transaction) => ({
          subscription: s,
          transaction,
          confirmation,
          cutoff,
          review: reviewed.get(transaction.id) ?? null,
          credits: credits.filter(
            (c) =>
              c.date >= transaction.date &&
              daysBetween(transaction.date, c.date) <= 60,
          ),
        }));
    })
    .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));
}
export type CancellationCase = ReturnType<typeof cancellationCases>[number];
export function cancellationEvidence(entry: CancellationCase, now: string) {
  const { subscription: s, transaction: t } = entry;
  return [
    "Subloom cancellation review packet",
    `Generated: ${now}`,
    "Prepared from user-supplied records; merchant cancellation, liability, and refund eligibility are not independently verified.",
    "",
    `Subscription: ${s.name}`,
    `User-recorded cancellation date: ${s.canceledAt}`,
    `Provider confirmation reference supplied by user: ${entry.confirmation}`,
    `Access paid through: ${s.paidThrough ?? "Not recorded"}`,
    `Review cutoff: ${entry.cutoff}`,
    "",
    `Imported charge date: ${t.date}`,
    `Merchant description: ${t.merchant}`,
    `Charge: ${formatMoney(t.amountMinor, t.currency)} ${t.currency}`,
    `Statement reference: ${t.reference || "Not supplied"}`,
    `Import timestamp: ${t.importedAt}`,
    `User review status: ${entry.review?.status ?? "open"}`,
    `User review note: ${entry.review?.note || "None"}`,
    "",
    "Related imported credits (review individually):",
    ...entry.credits.map(
      (c) =>
        `${c.date}: ${formatMoney(c.amountMinor, c.currency)} ${c.currency}; reference ${c.reference || "not supplied"}`,
    ),
    "",
    "Check billing terms, dates, fees and provider confirmation before contacting the provider or bank. No complaint or dispute was submitted by Subloom.",
  ].join("\n");
}
