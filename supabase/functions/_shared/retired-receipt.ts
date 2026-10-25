import { Webhook } from "svix";
import { env, HttpError, json, limited } from "./http.ts";

/** Acknowledge signed legacy deliveries without fetching or processing email. */
export async function acknowledgeRetiredReceipt(req: Request) {
  const body = await limited(req, 250_000);
  const secret = env("RESEND_WEBHOOK_SECRET");
  try {
    new Webhook(secret).verify(body, {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    });
  } catch {
    throw new HttpError(401, "Invalid webhook signature.");
  }
  return json({
    ignored: true,
    reason: "Receipt forwarding is no longer available.",
  });
}
