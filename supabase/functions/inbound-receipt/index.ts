import { Webhook } from "svix";
import { z } from "zod";
import {
  admin,
  endpoint,
  env,
  HttpError,
  json,
  limited,
  providerJson,
  rateLimit,
  sha256,
} from "../_shared/http.ts";
import { ingestReceipt } from "../_shared/ingestion.ts";
const webhookSchema = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().uuid(),
    to: z.array(z.string().max(320)).min(1).max(10),
    from: z.string().max(500),
    subject: z.string().max(500).optional(),
  }),
});
const emailSchema = z.object({
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  subject: z.string().max(500).optional(),
  attachments: z
    .array(
      z
        .object({
          filename: z.string().max(255).optional(),
          content_type: z.string().optional(),
        })
        .passthrough(),
    )
    .max(10)
    .optional(),
});
export const handler = endpoint(async (req) => {
  const body = await limited(req, 250_000),
    headers = {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    };
  let verified: unknown;
  try {
    verified = new Webhook(env("RESEND_WEBHOOK_SECRET")).verify(body, headers);
  } catch {
    throw new HttpError(401, "Invalid webhook signature.");
  }
  const event = webhookSchema.parse(verified);
  if (event.type !== "email.received") return json({ ignored: true });
  const domain = env("INBOUND_DOMAIN").toLowerCase(),
    client = admin();
  const recipients = event.data.to.filter((address) =>
    address.toLowerCase().endsWith("@" + domain),
  );
  let accepted = 0;
  for (const recipient of recipients) {
    const token = recipient
      .toLowerCase()
      .match(/^receipts\+([a-f0-9]{64})@/)?.[1];
    if (!token) continue;
    const { data: alias } = await client
      .from("inbound_email_aliases")
      .select("user_id")
      .eq("token_hash", await sha256(token))
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!alias) continue;
    await rateLimit(
      client,
      "inbound:" + alias.user_id,
      50,
      3600,
      alias.user_id,
    );
    const id = headers["svix-id"] + ":" + alias.user_id;
    const { data: claim, error: claimError } = await client.rpc(
      "claim_webhook",
      { event_id: id, owner: alias.user_id },
    );
    if (claimError) throw new HttpError(500, "Could not claim webhook.");
    if (claim === "done") {
      accepted++;
      continue;
    }
    if (claim !== "claimed")
      throw new HttpError(503, "Webhook processing is already in progress.");
    try {
      // The signed notification contains IDs and metadata, NOT the full body. Retrieve it securely.
      const email = emailSchema.parse(
        await providerJson(
          "https://api.resend.com/emails/receiving/" +
            encodeURIComponent(event.data.email_id),
          { headers: { Authorization: "Bearer " + env("RESEND_API_KEY") } },
        ),
      );
      const text = email.text || email.html || "";
      if (text.length > 100_000)
        throw new HttpError(413, "Receipt content is too large.");
      if (text.trim())
        await ingestReceipt(
          client,
          alias.user_id,
          (email.subject || event.data.subject || "") + "\n" + text,
          event.data.email_id,
          await sha256(event.data.from.trim().toLowerCase()),
        );
      const { error } = await client
        .from("webhook_receipts")
        .update({ state: "done", processed_at: new Date().toISOString() })
        .eq("id", id);
      if (error)
        throw new HttpError(500, "Could not complete webhook processing.");
      accepted++;
    } catch (error) {
      await client
        .from("webhook_receipts")
        .update({ state: "failed" })
        .eq("id", id);
      throw error;
    }
  }
  return json({ accepted, attachments: "not_ingested" });
});
Deno.serve(handler);
