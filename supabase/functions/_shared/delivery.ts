import { z } from "zod";
import { admin, env, HttpError } from "./http.ts";
import { emailTemplate } from "./email.ts";
import { signPreferencesToken } from "./preferences-token.ts";
const eventSchema = z.object({
  title: z.string().max(160),
  body: z.string().max(3000),
  path: z
    .string()
    .regex(/^\/(subscription|detection)\/[0-9a-f-]{36}$|^\/(settings)?$/i),
});
export async function enqueue(
  client: ReturnType<typeof admin>,
  event: {
    userId: string;
    key: string;
    subscriptionId?: string;
    version?: number;
    kind: string;
    payload: z.infer<typeof eventSchema>;
    dueAt: string;
  },
  channels: { email?: string; tokens?: string[] },
) {
  const payload = eventSchema.parse(event.payload);
  const { data, error } = await client
    .from("notification_events")
    .upsert(
      {
        user_id: event.userId,
        event_key: event.key,
        subscription_id: event.subscriptionId || null,
        subscription_version: event.version || null,
        kind: event.kind,
        payload,
        due_at: event.dueAt,
      },
      { onConflict: "event_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw new HttpError(500, "Could not schedule the reminder.");
  const id =
    data?.id ||
    (
      await client
        .from("notification_events")
        .select("id")
        .eq("event_key", event.key)
        .single()
    ).data?.id;
  if (!id) throw new HttpError(500, "Could not identify the reminder.");
  const deliveries = [
    ...(channels.email
      ? [{ channel: "email", destination: channels.email }]
      : []),
    ...(channels.tokens || []).map((token) => ({
      channel: "push",
      destination: token,
    })),
  ].map((d) => ({ ...d, event_id: id, user_id: event.userId }));
  if (deliveries.length) {
    const { error } = await client
      .from("notification_deliveries")
      .upsert(deliveries, {
        onConflict: "event_id,channel,destination",
        ignoreDuplicates: true,
      });
    if (error) throw new HttpError(500, "Could not queue delivery.");
    // Only revive deliveries suppressed by previous preferences, never accepted deliveries.
    for (const delivery of deliveries) {
      const { error } = await client
        .from("notification_deliveries")
        .update({
          status: "pending",
          error_code: null,
          next_attempt_at: new Date().toISOString(),
        })
        .eq("event_id", id)
        .eq("channel", delivery.channel)
        .eq("destination", delivery.destination)
        .eq("status", "suppressed")
        .eq("error_code", "preferences_changed");
      if (error)
        throw new HttpError(500, "Could not refresh reminder preferences.");
    }
  }
  return id as string;
}
export async function sendEmail(
  destination: string,
  key: string,
  content: z.infer<typeof eventSchema>,
  optional = false,
  recipient?: { userId: string; issuedAt: string },
) {
  const parsed = eventSchema.parse(content),
    base = Deno.env.get("APP_LINK_BASE") || "subloom://";
  const url = base.replace(/\/$/, "") + parsed.path;
  const preferencesUrl =
    optional && recipient
      ? env("SUPABASE_URL") +
        "/functions/v1/email-preferences?token=" +
        encodeURIComponent(
          await signPreferencesToken(recipient.userId, recipient.issuedAt),
        )
      : undefined;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env("RESEND_API_KEY"),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to: [destination],
      subject: parsed.title,
      html: emailTemplate({
        title: parsed.title,
        preview: parsed.body.slice(0, 100),
        body: parsed.body,
        action: "Open Subloom",
        url,
        preferencesUrl,
      }),
      text:
        parsed.title +
        "\n\n" +
        parsed.body +
        "\n\n" +
        url +
        "\n\nChange optional delivery preferences in Subloom Settings.",
      ...(preferencesUrl
        ? {
            headers: {
              "List-Unsubscribe": "<" + preferencesUrl + ">",
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 429 || response.status >= 500 ? 503 : 422,
      "Email delivery failed.",
    );
  const result = z.object({ id: z.string() }).parse(await response.json());
  return result.id;
}
export async function sendPush(
  destination: string,
  content: z.infer<typeof eventSchema>,
  privacy: boolean,
) {
  const parsed = eventSchema.parse(content),
    access = Deno.env.get("EXPO_ACCESS_TOKEN");
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: "Bearer " + access } : {}),
    },
    body: JSON.stringify({
      to: destination,
      sound: "default",
      channelId: "renewals",
      title: privacy ? "A heads-up from Subloom" : parsed.title,
      body: privacy
        ? "A subscription update is ready. Open Subloom to view it."
        : parsed.body,
      data: { path: parsed.path },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      "Push delivery could not be confirmed.",
    );
  const result = z
    .object({
      data: z.object({
        status: z.enum(["ok", "error"]),
        id: z.string().optional(),
        details: z.object({ error: z.string().optional() }).optional(),
      }),
    })
    .parse(await response.json());
  if (result.data.status === "error")
    throw new HttpError(
      result.data.details?.error === "DeviceNotRegistered" ? 410 : 422,
      result.data.details?.error || "Push rejected",
    );
  if (!result.data.id)
    throw new HttpError(502, "Push ticket was not returned.");
  return result.data.id;
}
