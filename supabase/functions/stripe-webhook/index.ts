import Stripe from "stripe";
import {
  admin,
  endpoint,
  env,
  HttpError,
  json,
  limited,
} from "../_shared/http.ts";
import { ProBilling, stripeClient } from "../_shared/proBilling.ts";
export async function verifiedEvent(req: Request, stripe: Stripe) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw new HttpError(400, "Missing webhook signature.");
  const body = await limited(req, 1024 * 1024);
  try {
    return await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env("STRIPE_WEBHOOK_SECRET"),
      300,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    throw new HttpError(400, "Invalid webhook signature.");
  }
}
export const handler = endpoint(async (req) => {
  const stripe = stripeClient();
  const event = await verifiedEvent(req, stripe);
  await new ProBilling(admin(), stripe).webhook(event);
  return json({ received: true });
});
if (import.meta.main) Deno.serve(handler);
