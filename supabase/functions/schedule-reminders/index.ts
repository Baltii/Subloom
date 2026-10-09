import { Temporal } from "@js-temporal/polyfill";
import {
  admin,
  endpoint,
  HttpError,
  json,
  requireCron,
} from "../_shared/http.ts";
import { enqueue } from "../_shared/delivery.ts";
import { welcomeContent } from "../_shared/email.ts";
import {
  preferencesSchema,
  subscriptionSchema,
} from "../../../src/domain/models.ts";
import {
  dueReminder,
  isQuiet,
  isHighRenewal,
} from "../../../src/domain/reminders.ts";
import { dateLabel, today, upcoming } from "../../../src/domain/renewal.ts";
import { formatMoney, recurringTotals } from "../../../src/domain/money.ts";
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
      if (userError || deviceError || profileError)
        throw new HttpError(500, "Could not read delivery preferences.");
      const verifiedEmail =
        Deno.env.get("RESEND_API_KEY") && Deno.env.get("EMAIL_FROM") && userResult.user?.email_confirmed_at && !accountProfile?.email_suppressed
          ? userResult.user.email
          : undefined;
      const tokens = p.pushEnabled
        ? (devices || []).map((d) => d.token as string)
        : [];
      const subscriptions = [];
      for (let offset = 0; ; offset += 500) {
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
        const content = welcomeContent("/");
        await enqueue(
          client,
          {
            userId: owner,
            key: "welcome:" + owner,
            kind: "welcome",
            payload: { title: content.title, body: content.body, path: "/" },
            dueAt: now.toISOString(),
          },
          { email: verifiedEmail },
        );
      }
      for (const s of subscriptions) {
        const reminder = dueReminder(s, p, now);
        if (!reminder) continue;
        const when =
          reminder.daysBefore === 0
            ? "today"
            : reminder.daysBefore === 1
              ? "tomorrow"
              : "in " + reminder.daysBefore + " days";
        await enqueue(
          client,
          {
            userId: owner,
            key: reminder.key,
            subscriptionId: s.id,
            version: s.version,
            kind: reminder.kind,
            dueAt: reminder.dueAt,
            payload: {
              title:
                reminder.kind === "trial"
                  ? "Your trial ends " + when + "."
                  : (isHighRenewal(s, p) ? "High upcoming renewal · " : "") +
                    s.name +
                    " renews " +
                    when +
                    ".",
              body:
                reminder.kind === "trial"
                  ? "Your " +
                    s.name +
                    " trial ends on " +
                    dateLabel(reminder.eventDate) +
                    ". Review your plan before billing begins."
                  : formatMoney(s.amountMinor, s.currency) +
                    " " +
                    s.currency +
                    " is scheduled on " +
                    dateLabel(reminder.eventDate) +
                    ". This is based on your tracked billing schedule.",
              path: "/subscription/" + s.id,
            },
          },
          { email: p.emailEnabled ? verifiedEmail : undefined, tokens },
        );
        scheduled++;
      }
      const local = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(
        p.timezone,
      );
      let digestHour = p.reminderHour;
      if (isQuiet(digestHour, p.quietStart, p.quietEnd))
        digestHour = p.quietEnd;
      if (
        p.weeklyDigest &&
        p.emailEnabled &&
        verifiedEmail &&
        local.dayOfWeek === 1 &&
        local.hour >= digestHour &&
        !isQuiet(local.hour, p.quietStart, p.quietEnd)
      ) {
        const events = upcoming(subscriptions, p.timezone, now).filter(
          (e) => e.days <= 7 && e.type !== "paid_through",
        );
        const totals = recurringTotals(subscriptions)
          .map(
            (t) =>
              formatMoney(t.monthly, t.currency) +
              " " +
              t.currency +
              "/month estimated",
          )
          .join("; ");
        const lines = events.map(
          (e) =>
            e.subscription.name +
            " · " +
            dateLabel(e.date) +
            " · " +
            formatMoney(e.subscription.amountMinor, e.subscription.currency),
        );
        await enqueue(
          client,
          {
            userId: owner,
            key: "digest:" + owner + ":" + today(p.timezone, now),
            kind: "digest",
            dueAt: now.toISOString(),
            payload: {
              title: "Your week, a little clearer.",
              body:
                events.length +
                " scheduled renewals in the next 7 days. " +
                (totals || "No recurring costs tracked yet.") +
                " " +
                lines.slice(0, 15).join("; "),
              path: "/",
            },
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
