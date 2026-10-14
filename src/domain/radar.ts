import { z } from "zod";
import {
  currencies,
  dateSchema,
  type Currency,
  type Subscription,
} from "./models";
import { parseCsv } from "./csv";
import { parseMoney } from "./money";
import { daysBetween } from "./renewal";
export const transactionSchema = z
  .object({
    id: z.string().uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    date: dateSchema,
    merchant: z.string().trim().min(1).max(80),
    amountMinor: z.number().int().positive().max(1_000_000_000),
    currency: z.enum(currencies),
    direction: z.enum(["debit", "credit"]),
    sourceId: z.string().uuid().nullable(),
    reference: z.string().max(80),
    subscriptionId: z.string().uuid().nullable(),
    ignored: z.boolean(),
    importedAt: z.string().datetime(),
  })
  .strict();
export type PaymentTransaction = z.infer<typeof transactionSchema>;
export const ledgerSchema = z
  .array(transactionSchema)
  .max(300)
  .superRefine((value, ctx) => {
    if (
      new Set(value.map((t) => t.fingerprint)).size !== value.length ||
      new Set(value.map((t) => t.id)).size !== value.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate transaction rows." });
    if (new TextEncoder().encode(JSON.stringify(value)).length > 131072)
      ctx.addIssue({
        code: "custom",
        message:
          "Statement history is full. Export your data before removing older imports.",
      });
  });
export const emptyLedger: PaymentTransaction[] = [];
export type StatementMapping = {
  date: number;
  merchant: number;
  amount: number;
  currency: number | null;
  reference: number | null;
};
export type StatementRow = Omit<
  PaymentTransaction,
  "id" | "fingerprint" | "subscriptionId" | "ignored" | "importedAt"
>;
export const statementExample =
  "Date,Merchant,Amount,Currency,Reference\n2026-07-20,GitHub,-12.34,USD,jul-github\n2026-08-20,GitHub,-12.34,USD,aug-github\n2026-09-20,GitHub,-14.99,USD,sep-github\n";
export function statementHeaders(input: string) {
  const header = parseCsv(input)[0];
  if (
    !header?.length ||
    header.length > 30 ||
    header.some((h) => !h.trim() || h.length > 80) ||
    new Set(header.map((h) => h.trim().toLowerCase())).size !== header.length
  )
    throw new Error("Use a CSV with 1–30 distinct named columns.");
  return header;
}
export function defaultMapping(headers: string[]): StatementMapping {
  const find = (names: string[]) => {
    const index = headers.findIndex((h) =>
      names.includes(h.trim().toLowerCase()),
    );
    return index >= 0 ? index : null;
  };
  return {
    date: find(["date", "posted date", "transaction date"]) ?? 0,
    merchant:
      find(["merchant", "description", "payee"]) ??
      Math.min(1, headers.length - 1),
    amount: find(["amount", "value"]) ?? Math.min(2, headers.length - 1),
    currency: find(["currency"]),
    reference: find(["reference", "transaction id", "id"]),
  };
}
export function normalizeMerchant(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function parseStatement(
  input: string,
  mapping: StatementMapping,
  currency: Currency,
  negativeDebits: boolean,
  sourceId: string | null,
): StatementRow[] {
  const headers = statementHeaders(input),
    rows = parseCsv(input).slice(1);
  const indices = Object.values(mapping).filter((i): i is number => i !== null);
  if (
    indices.some((i) => !Number.isInteger(i) || i < 0 || i >= headers.length) ||
    new Set(indices).size !== indices.length
  )
    throw new Error("Choose a different column for each mapped field.");
  if (!rows.length || rows.length > 300)
    throw new Error("Import 1–300 transaction rows at a time.");
  return rows.map((row, index) => {
    try {
      if (row.length !== headers.length)
        throw new Error("Column count does not match the header.");
      const merchant = row[mapping.merchant]!.trim(),
        date = dateSchema.parse(row[mapping.date]!.trim());
      if (
        !merchant ||
        merchant.length > 80 ||
        /[\r\n]/.test(merchant) ||
        /^[=+@]/.test(merchant) ||
        /\d{12,}/.test(merchant.replace(/[ -]/g, ""))
      )
        throw new Error(
          "Use a merchant description without card/account numbers or formulas.",
        );
      const selected = z
        .enum(currencies)
        .parse(
          mapping.currency === null
            ? currency
            : row[mapping.currency]!.trim().toUpperCase(),
        );
      const signed = row[mapping.amount]!.trim(),
        negative = signed.startsWith("-");
      const amountMinor = parseMoney(
        negative
          ? signed.slice(1)
          : signed.startsWith("+")
            ? signed.slice(1)
            : signed,
        selected,
      );
      if (!amountMinor) throw new Error("Zero-value rows are not payments.");
      const reference =
        mapping.reference === null ? "" : row[mapping.reference]!.trim();
      if (
        reference.length > 80 ||
        /[\r\n]/.test(reference) ||
        /\d{12,}/.test(reference.replace(/[ -]/g, ""))
      )
        throw new Error(
          "Use a short reference without full account/card numbers.",
        );
      return {
        date,
        merchant,
        amountMinor,
        currency: selected,
        direction:
          negative === negativeDebits
            ? ("debit" as const)
            : ("credit" as const),
        sourceId,
        reference,
      };
    } catch (error) {
      throw new Error(
        `Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid transaction."}`,
      );
    }
  });
}
export function statementFingerprintInput(row: StatementRow) {
  return JSON.stringify([
    row.date,
    normalizeMerchant(row.merchant),
    row.amountMinor,
    row.currency,
    row.direction,
    row.sourceId,
    row.reference,
  ]);
}
export function mergeStatement(
  existing: PaymentTransaction[],
  rows: PaymentTransaction[],
) {
  const seen = new Set(existing.map((t) => t.fingerprint));
  const added = rows.filter((t) => {
    if (seen.has(t.fingerprint)) return false;
    seen.add(t.fingerprint);
    return true;
  });
  return {
    added: added.length,
    skipped: rows.length - added.length,
    value: ledgerSchema.parse(
      [...added, ...existing].sort((a, b) => b.date.localeCompare(a.date)),
    ),
  };
}
export function suggestSubscriptions(
  transaction: PaymentTransaction,
  subscriptions: Subscription[],
) {
  const merchant = " " + normalizeMerchant(transaction.merchant) + " ";
  return subscriptions.filter(
    (s) =>
      s.currency === transaction.currency &&
      normalizeMerchant(s.name).length >= 3 &&
      merchant.includes(" " + normalizeMerchant(s.name) + " "),
  );
}
export function recurringStreams(transactions: PaymentTransaction[]) {
  const groups = new Map<string, PaymentTransaction[]>();
  for (const t of transactions)
    if (t.direction === "debit" && !t.ignored) {
      const key =
        normalizeMerchant(t.merchant) +
        "|" +
        t.currency +
        "|" +
        (t.sourceId ?? "");
      const rows = groups.get(key) ?? [];
      rows.push(t);
      groups.set(key, rows);
    }
  return [...groups].flatMap(([key, rows]) => {
    const sorted = rows.toSorted((a, b) => a.date.localeCompare(b.date)),
      dates = [...new Set(sorted.map((t) => t.date))];
    if (dates.length < 3) return [];
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i]!, d));
    const interval = gaps.every((d) => d >= 6 && d <= 8)
      ? "weekly"
      : gaps.every((d) => d >= 27 && d <= 32)
        ? "monthly"
        : gaps.every((d) => d >= 360 && d <= 370)
          ? "yearly"
          : null;
    if (!interval) return [];
    const latest = sorted.at(-1)!,
      previous = sorted.at(-2)!;
    return [
      {
        key,
        merchant: latest.merchant,
        currency: latest.currency,
        interval: interval as "weekly" | "monthly" | "yearly",
        count: dates.length,
        latest,
        changeMinor: latest.amountMinor - previous.amountMinor,
        confirmed: sorted.some((t) => t.subscriptionId !== null),
      },
    ];
  });
}
export function matchedDifference(
  t: PaymentTransaction,
  subscriptions: Subscription[],
) {
  const s = subscriptions.find((s) => s.id === t.subscriptionId);
  return s && s.currency === t.currency && t.direction === "debit"
    ? { subscription: s, difference: t.amountMinor - s.amountMinor }
    : null;
}
