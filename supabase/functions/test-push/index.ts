import { z } from "zod";
import {
  authenticated,
  endpoint,
  HttpError,
  json,
  limited,
  rateLimit,
} from "../_shared/http.ts";
import { enqueue } from "../_shared/delivery.ts";
import { preferencesSchema } from "../../../src/domain/models.ts";

export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  const text = await limited(req, 2000);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid test notification request.");
  }
  const parsed = z.object({
    installationId: z.string().uuid(),
    requestId: z.string().uuid(),
  }).strict().safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid test notification request.");
  }
  const body = parsed.data;
  await rateLimit(client, "test-push:" + user.id, 3, 3600, user.id);
  const [
    { data: device, error: deviceError },
    { data: row, error: prefError },
  ] = await Promise.all([
    client.from("push_devices").select("token,enabled").eq(
      "id",
      body.installationId,
    ).eq("user_id", user.id).maybeSingle(),
    client.from("user_preferences").select("data").eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (deviceError || prefError) {
    throw new HttpError(503, "Could not check device registration.");
  }
  if (!device?.enabled) {
    throw new HttpError(404, "Enable push on this device first.");
  }
  if (!row || !preferencesSchema.parse(row.data).pushEnabled) {
    throw new HttpError(409, "Enable account push reminders first.");
  }
  const eventId = await enqueue(client, {
    userId: user.id,
    key: "test:" + user.id + ":" + body.requestId,
    kind: "test",
    dueAt: new Date().toISOString(),
    payload: {
      title: "A heads-up from Subloom",
      body: "Your test notification reached this device.",
      path: "/settings",
    },
  }, { tokens: [device.token] });
  return json({ queued: true, eventId }, 202);
});
Deno.serve(handler);
