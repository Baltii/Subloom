import { z } from "zod";
import {
  authenticated,
  endpoint,
  HttpError,
  json,
  limited,
  rateLimit,
} from "../_shared/http.ts";
import { requireReceiptAddressActionAvailable } from "../_shared/tool-availability.ts";
export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  const body = z
    .object({
      action: z.enum(["list", "create", "revoke"]),
      id: z.string().uuid().optional(),
    })
    .parse(JSON.parse(await limited(req, 4096)));
  requireReceiptAddressActionAvailable(body.action);
  await rateLimit(client, "aliases:" + user.id, 20, 3600, user.id);
  if (body.action === "list") {
    const { data, error } = await client
      .from("inbound_email_aliases")
      .select("id,address,expires_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());
    if (error) throw new HttpError(500, "Could not list addresses.");
    return json({ aliases: data });
  }
  if (body.action === "revoke") {
    if (!body.id) throw new HttpError(400, "Address required.");
    const { error } = await client
      .from("inbound_email_aliases")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("id", body.id);
    if (error) throw new HttpError(500, "Could not revoke address.");
    return json({ ok: true });
  }
  throw new HttpError(410, "Receipt forwarding is no longer available.");
});
Deno.serve(handler);
