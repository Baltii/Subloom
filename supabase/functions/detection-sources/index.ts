import { z } from "zod";
import {
  authenticated,
  endpoint,
  env,
  HttpError,
  json,
  limited,
  rateLimit,
  sha256,
} from "../_shared/http.ts";
export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  const body = z
    .object({
      action: z.enum(["list", "create", "revoke"]),
      id: z.string().uuid().optional(),
    })
    .parse(JSON.parse(await limited(req, 4096)));
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
  if (!user.email_confirmed_at)
    throw new HttpError(403, "Verify your account email first.");
  const domain = env("INBOUND_DOMAIN");
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain))
    throw new HttpError(503, "Receiving domain not configured.");
  const bytes = crypto.getRandomValues(new Uint8Array(32)),
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const address = "receipts+" + token + "@" + domain;
  const expires = new Date(Date.now() + 90 * 86_400_000).toISOString();
  const { data, error } = await client.rpc("create_receipt_alias", {
    owner: user.id,
    alias_address: address,
    hash: await sha256(token),
    expires,
  });
  if (error)
    throw new HttpError(
      409,
      "You can have up to three active addresses. Revoke one before creating another.",
    );
  return json({ alias: { id: data, address, expires_at: expires } });
});
Deno.serve(handler);
