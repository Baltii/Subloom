import { feedbackRequestSchema } from "../../../src/domain/feedback.ts";
import { type admin, HttpError, json, limited, rateLimit } from "./http.ts";

export async function feedbackNetworkKey(req: Request, secret: string) {
  // The hosted Supabase endpoint is behind Cloudflare ingress. Do not trust a
  // caller-provided X-Forwarded-For chain. Missing IP metadata shares one bucket.
  const address = req.headers.get("cf-connecting-ip")?.trim().slice(0, 64) ||
    "unknown";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("feedback-network:" + address),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function receiveFeedback(
  req: Request,
  client: ReturnType<typeof admin>,
  secret: string,
  notify: (id: string) => Promise<unknown>,
) {
  let raw: unknown;
  try {
    raw = JSON.parse(await limited(req, 20_000));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Check your feedback and try again.");
  }
  const parsed = feedbackRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "Check your feedback and optional email, then try again.",
    );
  }
  const body = parsed.data;
  const network = await feedbackNetworkKey(req, secret);
  await rateLimit(client, "feedback:hour:" + network, 6, 3600);
  await rateLimit(client, "feedback:day:" + network, 30, 86400);
  await rateLimit(client, "feedback:global", 1000, 86400);
  const { error } = await client.from("app_feedback").upsert({
    id: body.id,
    kind: body.kind,
    title: body.title,
    message: body.message,
    reply_email: body.replyEmail,
    platform: body.platform,
    app_version: body.appVersion,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    throw new HttpError(503, "Couldn’t save your feedback. Please try again.");
  }
  try {
    await notify(body.id);
  } catch {
    /* The durable outbox and scheduled worker retry failed email sends. */
  }
  return json({ accepted: true, id: body.id });
}
