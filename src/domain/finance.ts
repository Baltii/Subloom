import { z } from "zod";
import { currencies, dateSchema } from "./models";

// Labels must never become a second field for full card numbers.
export const financeLabel = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(
    (v) => !/\d{12,}/.test(v.replace(/[ -]/g, "")),
    "Use a name, not a full card number.",
  );
export const walletKinds = ["card", "apple_wallet", "google_wallet"] as const;
export const walletSchema = z
  .object({
    id: z.string().uuid(),
    name: financeLabel,
    kind: z.enum(walletKinds),
    lastFour: z.string().regex(/^(?:\d{4})?$/),
    archived: z.boolean(),
  })
  .strict();
export const transactionSchema = z
  .object({
    id: z.string().uuid(),
    merchant: financeLabel,
    amountMinor: z.number().int().positive().max(1_000_000_000),
    currency: z.enum(currencies),
    date: dateSchema,
    kind: z.enum(["charge", "refund"]),
    status: z.enum(["settled", "pending", "failed"]),
    walletId: z.string().uuid().nullable(),
    subscriptionId: z.string().uuid().nullable(),
    source: z.literal("manual"),
    createdAt: z.string().datetime(),
  })
  .strict();
export const financeSchema = z
  .object({
    wallets: z.array(walletSchema).max(50),
    transactions: z.array(transactionSchema).max(300),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const list of [value.wallets, value.transactions])
      if (new Set(list.map((v) => v.id)).size !== list.length)
        ctx.addIssue({
          code: "custom",
          message: "Duplicate financial record.",
        });
    const ids = new Set(value.wallets.map((v) => v.id));
    if (value.transactions.some((t) => t.walletId && !ids.has(t.walletId)))
      ctx.addIssue({
        code: "custom",
        message: "Choose an existing card or wallet.",
      });
  });
export type Finance = z.infer<typeof financeSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export const initialFinance: Finance = { wallets: [], transactions: [] };
export const walletLabels = {
  card: "Custom card",
  apple_wallet: "Apple Wallet",
  google_wallet: "Google Wallet",
};
export function transactionTotals(transactions: Transaction[]) {
  const totals = new Map<
    Transaction["currency"],
    { charges: number; refunds: number }
  >();
  for (const t of transactions) {
    if (t.status !== "settled") continue;
    const group = totals.get(t.currency) ?? { charges: 0, refunds: 0 };
    if (t.kind === "charge") group.charges += t.amountMinor;
    else group.refunds += t.amountMinor;
    totals.set(t.currency, group);
  }
  return [...totals].map(([currency, group]) => ({
    currency,
    ...group,
    net: group.charges - group.refunds,
  }));
}
