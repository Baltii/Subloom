import { z } from "zod";
import {
  admin,
  endpoint,
  HttpError,
  json,
  requireCron,
} from "../_shared/http.ts";
import { sendEmail, sendPush } from "../_shared/delivery.ts";
import {
  preferencesSchema,
  subscriptionSchema,
} from "../../../src/domain/models.ts";
import { dueReminder, isQuiet } from "../../../src/domain/reminders.ts";
import { Temporal } from "@js-temporal/polyfill";
export const handler = endpoint(async (req) => {
  requireCron(req);
  const client = admin();
  const { data: deliveries, error } = await client.rpc("claim_deliveries", {
    batch_size: 5,
  });
  if (error) throw new HttpError(500, "Could not claim deliveries.");
  let accepted = 0,
    failed = 0;
  for (const delivery of deliveries || []) {
    const update = async (values: Record<string, unknown>) => {
      const { error } = await client
        .from("notification_deliveries")
        .update({ ...values, lease_until: null })
        .eq("id", delivery.id)
        .eq("lease_token", delivery.lease_token)
        .eq("status", "sending");
      if (error) throw new HttpError(500, "Could not record delivery outcome.");
    };
    try {
      const [
        { data: event, error: eventError },
        { data: pref, error: prefError },
        { data: profile, error: profileError },
      ] = await Promise.all([
        client
          .from("notification_events")
          .select("*")
          .eq("id", delivery.event_id)
          .eq("user_id", delivery.user_id)
          .maybeSingle(),
        client
          .from("user_preferences")
          .select("data")
          .eq("user_id", delivery.user_id)
          .maybeSingle(),
        client
          .from("profiles")
          .select("email_suppressed")
          .eq("user_id", delivery.user_id)
          .single(),
      ]);
      if (eventError || prefError || profileError)
        throw new HttpError(503, "Could not validate delivery state.");
      if (!event || event.invalidated_at || !pref) {
        await update({ status: "suppressed", error_code: "outdated_event" });
        continue;
      }
      const p = preferencesSchema.parse(pref.data),
        now = new Date();
      if (event.subscription_id) {
        const { data: row, error } = await client
          .from("subscriptions")
          .select("data,version")
          .eq("id", event.subscription_id)
          .eq("user_id", delivery.user_id)
          .maybeSingle();
        if (error) throw new HttpError(503, "Could not validate subscription.");
        if (!row || row.version !== event.subscription_version) {
          await update({
            status: "suppressed",
            error_code: "outdated_subscription",
          });
          continue;
        }
        const reminder = dueReminder(
          subscriptionSchema.parse(row.data),
          p,
          now,
        );
        if (!reminder || reminder.key !== event.event_key) {
          await update({
            status: "suppressed",
            error_code: "preferences_changed",
          });
          continue;
        }
      }
      if (event.kind === "candidate") {
        const id = String(event.payload.path).split("/").at(-1);
        const { data: candidate, error } = await client
          .from("detected_candidates")
          .select("state")
          .eq("id", id)
          .eq("user_id", delivery.user_id)
          .maybeSingle();
        if (error) throw new HttpError(503, "Could not validate detection.");
        if (!candidate || candidate.state !== "pending") {
          await update({
            status: "suppressed",
            error_code: "candidate_reviewed",
          });
          continue;
        }
      }
      if (event.kind !== "welcome" && event.kind !== "test") {
        const local = Temporal.Instant.from(
          now.toISOString(),
        ).toZonedDateTimeISO(p.timezone);
        if (isQuiet(local.hour, p.quietStart, p.quietEnd)) {
          await update({
            status: "pending",
            next_attempt_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          });
          continue;
        }
      }
      if (delivery.channel === "email") {
        const { data, error } = await client.auth.admin.getUserById(
          delivery.user_id,
        );
        if (error)
          throw new HttpError(503, "Could not verify email destination.");
        if (
          !data.user?.email_confirmed_at ||
          data.user.email !== delivery.destination ||
          profile?.email_suppressed ||
          (event.kind !== "welcome" && !p.emailEnabled) ||
          (event.kind === "digest" && !p.weeklyDigest)
        ) {
          await update({
            status: "suppressed",
            error_code: "preferences_changed",
          });
          continue;
        }
        const providerId = await sendEmail(
          delivery.destination,
          "subloom/" + delivery.id,
          event.payload,
          event.kind === "digest",
          { userId: delivery.user_id, issuedAt: delivery.created_at },
        );
        const { error: emailError } = await client
          .from("email_deliveries")
          .upsert(
            {
              user_id: delivery.user_id,
              delivery_id: delivery.id,
              provider_id: providerId,
              status: "accepted",
            },
            { onConflict: "delivery_id" },
          );
        if (emailError)
          throw new HttpError(503, "Could not record email acceptance.");
        await update({ status: "accepted", provider_id: providerId });
      } else {
        const { data: device, error } = await client
          .from("push_devices")
          .select("id")
          .eq("user_id", delivery.user_id)
          .eq("token", delivery.destination)
          .eq("enabled", true)
          .maybeSingle();
        if (error) throw new HttpError(503, "Could not validate push device.");
        if (!p.pushEnabled || !device) {
          await update({
            status: "suppressed",
            error_code: "preferences_changed",
          });
          continue;
        }
        const providerId = await sendPush(
          delivery.destination,
          event.payload,
          p.privacyMode,
        );
        await update({ status: "accepted", provider_id: providerId });
      }
      accepted++;
      const activity = {
        id: delivery.id,
        type: "reminder",
        title: "Reminder accepted by provider",
        detail:
          delivery.channel === "email"
            ? "Email submitted. Delivery status is tracked separately."
            : "Push submitted. Device delivery is being checked.",
        targetId: event.subscription_id || null,
        createdAt: new Date().toISOString(),
      };
      const { error: activityError } = await client
        .from("subscription_activity")
        .upsert(
          { id: activity.id, user_id: delivery.user_id, data: activity },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (activityError)
        throw new HttpError(500, "Could not record reminder activity.");
    } catch (e) {
      const code = e instanceof HttpError ? e.status : 500;
      if (code === 410)
        await client
          .from("push_devices")
          .update({ enabled: false })
          .eq("user_id", delivery.user_id)
          .eq("token", delivery.destination);
      const retryable =
        delivery.channel === "email" && code >= 500 && delivery.attempts < 5;
      const uncertain =
        delivery.channel === "push" &&
        code !== 410 &&
        code !== 422 &&
        code !== 429;
      await update({
        status:
          retryable ||
          (delivery.channel === "push" && code === 429 && delivery.attempts < 5)
            ? "pending"
            : uncertain
              ? "unknown"
              : "failed",
        error_code: String(code),
        next_attempt_at: new Date(
          Date.now() + Math.min(3600, 30 * 2 ** delivery.attempts) * 1000,
        ).toISOString(),
      });
      failed++;
    }
  }
  // Poll Expo tickets after 15 minutes; a ticket is provider acceptance, not delivery.
  const { data: tickets, error: ticketError } = await client
    .from("notification_deliveries")
    .select("id,user_id,destination,provider_id")
    .eq("channel", "push")
    .eq("status", "accepted")
    .lt("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .limit(1000);
  if (ticketError)
    throw new HttpError(500, "Could not retrieve pending push receipts.");
  if (tickets?.length) {
    const access = Deno.env.get("EXPO_ACCESS_TOKEN");
    const response = await fetch(
      "https://exp.host/--/api/v2/push/getReceipts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(access ? { Authorization: "Bearer " + access } : {}),
        },
        body: JSON.stringify({ ids: tickets.map((t) => t.provider_id) }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.ok) {
      const receipts = z
        .object({
          data: z.record(
            z.object({
              status: z.enum(["ok", "error"]),
              details: z.object({ error: z.string().optional() }).optional(),
            }),
          ),
        })
        .parse(await response.json());
      for (const ticket of tickets) {
        const receipt = receipts.data[ticket.provider_id];
        if (!receipt) continue;
        const { error } = await client
          .from("notification_deliveries")
          .update({
            status: receipt.status === "ok" ? "delivered" : "failed",
            error_code: receipt.details?.error || null,
            delivered_at:
              receipt.status === "ok" ? new Date().toISOString() : null,
          })
          .eq("id", ticket.id)
          .eq("status", "accepted");
        if (error) throw new HttpError(500, "Could not record push receipt.");
        if (receipt.details?.error === "DeviceNotRegistered")
          await client
            .from("push_devices")
            .update({ enabled: false })
            .eq("user_id", ticket.user_id)
            .eq("token", ticket.destination);
      }
    }
  }
  return json({ accepted, failed });
});
Deno.serve(handler);
