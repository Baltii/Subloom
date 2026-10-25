import { z } from "zod";
import { requirePaidPlans } from "../_shared/plan-mode.ts";
import {
  authenticated,
  endpoint,
  HttpError,
  json,
  limited,
  rateLimit,
} from "../_shared/http.ts";
import {
  billingConfigured,
  ProBilling,
  stripeClient,
} from "../_shared/proBilling.ts";
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), device: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal("checkout"),
      interval: z.enum(["month", "year"]),
    })
    .strict(),
  z.object({ action: z.literal("portal") }).strict(),
  z.object({ action: z.literal("cancel") }).strict(),
]);
export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  if (!user.email || !user.email_confirmed_at) {
    throw new HttpError(403, "Verify your billing email to continue.");
  }
  const raw = await limited(req, 2048);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid billing request.");
  }
  const body = input.safeParse(parsed);
  if (!body.success) throw new HttpError(400, "Invalid billing request.");
  await rateLimit(client, "pro:" + user.id, 60, 3600, user.id);
  if (body.data.action === "checkout") await requirePaidPlans(client);
  if (!billingConfigured()) {
    if (body.data.action === "status") {
      return json({
        configured: false,
        verificationKey: null,
        pro: false,
        status: "none",
        license: null,
        trialEligible: true,
        canManage: false,
        interval: null,
        accessUntil: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        tracking: null,
      });
    }
    throw new HttpError(503, "Pro purchases are not available yet.");
  }
  const billing = new ProBilling(client, stripeClient());
  if (body.data.action === "checkout") {
    return json(await billing.checkout(user, body.data.interval));
  }
  if (body.data.action === "portal") return json(await billing.portal(user.id));
  if (body.data.action === "cancel") return json(await billing.cancel(user));
  const device = body.data.device;
  return json(
    await billing.locked(user.id, async (row, save) => {
      const subscription = await billing.sync(row, save, user.email);
      return await billing.snapshot(row, user.email!, device, subscription);
    }),
  );
});
Deno.serve(handler);
