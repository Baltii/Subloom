import { createClient } from "@supabase/supabase-js";
import {
  env,
  authenticated,
  endpoint,
  HttpError,
  json,
  rateLimit,
} from "../_shared/http.ts";
export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  await rateLimit(client, "export:" + user.id, 5, 3600, user.id);
  const tables = [
    "profiles",
    "user_preferences",
    "feature_settings",
    "finance_journals",
    "crypto_journals",
    "crypto_address_history",
    "subscriptions",
    "subscription_price_history",
    "detected_candidates",
    "subscription_activity",
    "detection_evidence_metadata",
    "detection_sources",
    "inbound_email_aliases",
    "connected_accounts",
    "mailbox_connections",
    "notification_events",
    "notification_deliveries",
    "email_deliveries",
    "user_entitlements",
  ];
  const result: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    email: user.email,
    scope:
      "Complete cloud account data. Push tokens and authentication credentials are excluded.",
  };
  for (const table of tables) {
    const rows: unknown[] = [];
    for (let start = 0; ; start += 500) {
      const order =
        table === "feature_settings"
          ? "key"
          : table === "crypto_address_history"
            ? "wallet_id"
            : [
                  "profiles",
                  "user_entitlements",
                  "finance_journals",
                  "crypto_journals",
                  "crypto_address_history",
                ].includes(table)
              ? "user_id"
              : "id";
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("user_id", user.id)
        .order(order)
        .range(start, start + 499);
      if (error) throw new HttpError(500, "Could not export all account data.");
      rows.push(
        ...(data || []).map((row) => {
          const safe = { ...row };
          delete safe.token_hash;
          if (table === "notification_deliveries") delete safe.destination;
          return safe;
        }),
      );
      if (!data || data.length < 500) break;
    }
    result[table] = rows;
  }
  const scoped = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("authorization")! } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const table of [
    "workspaces",
    "workspace_members",
    "workspace_subscriptions",
    "workspace_ledger",
  ]) {
    const rows: unknown[] = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await scoped
        .from(table)
        .select("*")
        .order(table === "workspace_members" ? "user_id" : "id")
        .range(start, start + 499);
      if (error)
        throw new HttpError(500, "Could not export shared workspace data.");
      rows.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    result[table] = rows;
  }
  return json(result);
});
Deno.serve(handler);
