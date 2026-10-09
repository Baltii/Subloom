import { Webhook } from "svix";
import { z } from "zod";
import {
  admin,
  endpoint,
  env,
  HttpError,
  json,
  limited,
} from "../_shared/http.ts";
const schema = z.object({
  type: z.string(),
  created_at: z.string().max(80).optional(),
  data: z.object({ email_id: z.string() }),
});
export const handler = endpoint(async (req) => {
  const raw = await limited(req, 100_000);
  let verified: unknown;
  try {
    verified = new Webhook(env("RESEND_DELIVERY_WEBHOOK_SECRET")).verify(raw, {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    });
  } catch {
    throw new HttpError(401, "Invalid webhook signature.");
  }
  const event = schema.parse(verified),
    mapping: Record<string, string> = {
      "email.delivered": "delivered",
      "email.bounced": "failed",
      "email.complained": "failed",
      "email.failed": "failed",
    };
  const status = mapping[event.type];
  if (!status) return json({ ignored: true });
  const client = admin(),
    { data: delivery, error } = await client
      .from("email_deliveries")
      .select("id,user_id,delivery_id,status")
      .eq("provider_id", event.data.email_id)
      .maybeSingle();
  if (error) throw new HttpError(500, "Could not identify email delivery.");
  // A webhook may arrive before sender persistence. Ask the provider to retry instead of dropping it.
  if (
    !delivery &&
    event.created_at &&
    Date.parse(event.created_at) < Date.now() - 5 * 60_000
  )
    return json({ ignored: true, reason: "untracked_delivery" });
  // Auth SMTP emails are not reminder deliveries. Allow a short acceptance race window,
  // then acknowledge untracked/expired events instead of retrying them indefinitely.
  if (!delivery)
    throw new HttpError(503, "Delivery acceptance is still being recorded.");
  if (delivery.status === "failed" && status === "delivered")
    return json({ ignored: true });
  const { error: emailError } = await client
    .from("email_deliveries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", delivery.id);
  const { error: deliveryError } = await client
    .from("notification_deliveries")
    .update({
      status,
      error_code: status === "failed" ? event.type : null,
      delivered_at: status === "delivered" ? new Date().toISOString() : null,
    })
    .eq("id", delivery.delivery_id);
  if (emailError || deliveryError)
    throw new HttpError(500, "Could not record email delivery.");
  if (["email.bounced", "email.complained"].includes(event.type)) {
    const { error } = await client
      .from("profiles")
      .update({ email_suppressed: true })
      .eq("user_id", delivery.user_id);
    if (error) throw new HttpError(500, "Could not suppress email delivery.");
  }
  return json({ ok: true });
});
Deno.serve(handler);
