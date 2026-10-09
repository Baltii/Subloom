import {
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
    "subscriptions",
    "detected_candidates",
    "subscription_activity",
    "detection_evidence_metadata",
    "detection_sources",
    "inbound_email_aliases",
    "connected_accounts",
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
      const order = ["profiles", "user_entitlements"].includes(table)
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
  return json(result);
});
Deno.serve(handler);
