import { z } from "zod";
import { accountClient } from "./supabase";
import { ledgerEntrySchema, type LedgerDraft } from "../domain/settlements";
export async function settlementHistory(identity: string, scope: string) {
  const client = await accountClient(identity);
  const { data, error } = await client.rpc("workspace_ledger_history", {
    scope,
  });
  if (error)
    throw new Error(
      "Shared ledger could not load. Check your membership, connection and migration setup.",
    );
  return z.array(ledgerEntrySchema).max(2000).parse(data);
}
export async function recordSettlementEntry(
  identity: string,
  draft: LedgerDraft,
) {
  const client = await accountClient(identity);
  const payload = { ...draft, recorded_by: identity };
  const { data, error } = await client
    .from("workspace_ledger")
    .insert(payload)
    .select("*")
    .single();
  if (!error) return ledgerEntrySchema.parse(data);
  if (error.code === "23505") {
    const existing = await client
      .from("workspace_ledger")
      .select("*")
      .eq("id", draft.id)
      .eq("workspace_id", draft.workspace_id)
      .maybeSingle();
    if (!existing.error && existing.data) {
      const row = ledgerEntrySchema.parse(existing.data);
      if (
        Object.entries(draft).every(
          ([key, value]) =>
            JSON.stringify(row[key as keyof typeof row]) ===
            JSON.stringify(value),
        )
      )
        return row;
    }
    throw new Error(
      "This charge or request ID is already recorded. Reload history before retrying.",
    );
  }
  throw new Error(
    error.message || "Could not save this record. Your input is still here.",
  );
}
export async function setLedgerVoided(
  identity: string,
  id: string,
  version: number,
  voided: boolean,
) {
  const client = await accountClient(identity);
  const { data, error } = await client
    .from("workspace_ledger")
    .update({ voided })
    .eq("id", id)
    .eq("version", version)
    .select("*")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "Could not correct this record. Reload history; only its recorder or workspace owner can change it.",
    );
  return ledgerEntrySchema.parse(data);
}
