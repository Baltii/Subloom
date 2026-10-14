import { z } from "zod";
import { currencies, dateSchema } from "./models";
import { shareSchema } from "./workspaces";
import { formatMoney } from "./money";
export const ledgerEntrySchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  recorded_by: z.string().uuid(),
  kind: z.enum(["charge", "settlement", "request"]),
  payer: z.string().uuid(),
  payee: z.string().uuid().nullable(),
  currency: z.enum(currencies),
  amount_minor: z.number().int().positive().max(1_000_000_000),
  event_date: dateSchema,
  subscription_id: z.string().uuid().nullable(),
  shares: z.array(shareSchema).max(50),
  note: z.string().trim().min(1).max(160),
  due_date: dateSchema.nullable(),
  voided: z.boolean(),
  version: z.number().int().positive(),
  created_at: z.string(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type LedgerDraft = Omit<
  LedgerEntry,
  "recorded_by" | "voided" | "version" | "created_at"
>;
export function settlementBalances(entries: LedgerEntry[]) {
  const pairs = new Map<
    string,
    {
      workspaceId: string;
      first: string;
      second: string;
      currency: LedgerEntry["currency"];
      minor: bigint;
    }
  >();
  function debt(
    workspaceId: string,
    debtor: string,
    creditor: string,
    currency: LedgerEntry["currency"],
    minor: number,
  ) {
    if (debtor === creditor || !minor) return;
    const [first, second] = [debtor, creditor].sort() as [string, string],
      key = workspaceId + ":" + first + ":" + second + ":" + currency;
    const pair = pairs.get(key) ?? {
      workspaceId,
      first,
      second,
      currency,
      minor: 0n,
    };
    pair.minor += BigInt(minor) * (debtor === first ? 1n : -1n);
    pairs.set(key, pair);
  }
  for (const e of entries) {
    if (e.voided) continue;
    if (e.kind === "charge")
      for (const share of e.shares)
        debt(
          e.workspace_id,
          share.userId,
          e.payer,
          e.currency,
          share.amountMinor,
        );
    if (e.kind === "settlement" && e.payee)
      debt(e.workspace_id, e.payer, e.payee, e.currency, -e.amount_minor);
  }
  return [...pairs.values()]
    .filter((p) => p.minor !== 0n)
    .map((p) => ({
      workspaceId: p.workspaceId,
      debtor: p.minor > 0n ? p.first : p.second,
      creditor: p.minor > 0n ? p.second : p.first,
      currency: p.currency,
      amountMinor: Number(p.minor < 0n ? -p.minor : p.minor),
    }));
}
export function requestDraft(
  entry: LedgerEntry,
  payerName: string,
  payeeName: string,
) {
  return `${payeeName} requests ${formatMoney(entry.amount_minor, entry.currency)} ${entry.currency} from ${payerName}. Reference: ${entry.note}.${entry.due_date ? " Due: " + entry.due_date + "." : ""} This is a recorded request from Subloom; no payment link, money transfer or automatic message has been sent.`;
}
