import { Temporal } from "@js-temporal/polyfill";
import {
  admin,
  endpoint,
  HttpError,
  json,
  requireCron,
} from "../_shared/http.ts";
import { enqueue } from "../_shared/delivery.ts";
import {
  subscriptionNotification,
  welcomeNotification,
} from "../_shared/notification-emails.ts";
import {
  preferencesSchema,
  subscriptionSchema,
} from "../../../src/domain/models.ts";
import {
  dueReminder,
  isHighRenewal,
  isQuiet,
} from "../../../src/domain/reminders.ts";
import { today } from "../../../src/domain/renewal.ts";
import { weeklyDigest } from "../_shared/weekly-digest.ts";
import { exchangeRateSchema } from "../../../src/domain/exchangeRates.ts";
export const handler = endpoint(async (req) => {
  requireCron(req);
  const client = admin(),
    now = new Date();
  const { data: profiles, error } = await client.rpc("claim_schedule_users", {
    batch_size: 25,
  });
  if (error) throw new HttpError(500, "Could not claim scheduling work.");
  let scheduled = 0,
    failures = 0;
  for (const profile of profiles || []) {
    try {
      const p = preferencesSchema.parse(profile.data),
        owner = profile.user_id as string;
      const [
        { data: userResult, error: userError },
        { data: devices, error: deviceError },
        { data: accountProfile, error: profileError },
      ] = await Promise.all([
        client.auth.admin.getUserById(owner),
        client
          .from("push_devices")
          .select("token")
          .eq("user_id", owner)
          .eq("enabled", true),
        client
          .from("profiles")
          .select("email_suppressed,welcome_sent_at")
          .eq("user_id", owner)
          .single(),
      ]);
      if (userError || deviceError || profileError) {
        throw new HttpError(500, "Could not read delivery preferences.");
      }
      const verifiedEmail =
        Deno.env.get("RESEND_API_KEY") && Deno.env.get("EMAIL_FROM") &&
          userResult.user?.email_confirmed_at &&
          !accountProfile?.email_suppressed
          ? userResult.user.email
          : undefined;
      const tokens = p.pushEnabled
        ? (devices || []).map((d) => d.token as string)
        : [];
      const subscriptions = [];
      for (let offset = 0;; offset += 500) {
        const { data, error } = await client
          .from("subscriptions")
          .select("data")
          .eq("user_id", owner)
          .order("id")
          .range(offset, offset + 499);
        if (error) throw new HttpError(500, "Could not load subscriptions.");
        subscriptions.push(
          ...(data || []).map((row) => subscriptionSchema.parse(row.data)),
        );
        if (!data || data.length < 500) break;
      }
      if (verifiedEmail && !accountProfile?.welcome_sent_at) {
        await enqueue(
          client,
          {
            userId: owner,
            key: "welcome:" + owner,
            kind: "welcome",
            payload: welcomeNotification(),
            dueAt: now.toISOString(),
          },
          { email: verifiedEmail },
        );
      }
      for (const s of subscriptions) {
        const reminder = dueReminder(s, p, now);
        if (!reminder) continue;
        await enqueue(
          client,
          {
            userId: owner,
            key: reminder.key,
            subscriptionId: s.id,
            version: s.version,
            kind: reminder.kind,
            dueAt: reminder.dueAt,
            payload: subscriptionNotification(
              reminder.kind === "ending"
                ? "plan_ending"
                : reminder.kind === "trial"
                ? "trial_ending"
                : reminder.daysBefore === 0
                ? "renewal_today"
                : "renewal_upcoming",
              s,
              {
                eventDate: reminder.eventDate,
                daysBefore: reminder.daysBefore,
                highRenewal: isHighRenewal(s, p),
              },
            ),
          },
          { email: p.emailEnabled ? verifiedEmail : undefined, tokens },
        );
        scheduled++;
      }
      const local = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(
        p.timezone,
      );
      let digestHour = p.reminderHour;
      if (isQuiet(digestHour, p.quietStart, p.quietEnd)) {
        digestHour = p.quietEnd;
      }
      if (
        p.weeklyDigest &&
        p.emailEnabled &&
        verifiedEmail &&
        local.dayOfWeek === 1 &&
        local.hour >= digestHour &&
        !isQuiet(local.hour, p.quietStart, p.quietEnd)
      ) {
        const needsRates = subscriptions.some((s) => s.currency !== p.currency);
        const { data: rateData, error: rateError } = needsRates
          ? await client.from("latest_exchange_rates").select("*")
          : { data: [], error: null };
        if (rateError) {
          throw new HttpError(503, "Could not load weekly estimate rates.");
        }
        const payload = weeklyDigest(
          subscriptions,
          p,
          exchangeRateSchema.array().parse(rateData || []),
          now,
        );
        await enqueue(
          client,
          {
            userId: owner,
            key: "digest:" + owner + ":" + today(p.timezone, now),
            kind: "digest",
            dueAt: now.toISOString(),
            payload,
          },
          { email: verifiedEmail },
        );
        scheduled++;
      }
    } catch {
      failures++;
      await client
        .from("user_preferences")
        .update({ next_check_at: new Date(Date.now() + 60_000).toISOString() })
        .eq("user_id", profile.user_id);
    }
  }
  return json({ scheduled, failures, users: profiles?.length || 0 });
});
Deno.serve(handler);
