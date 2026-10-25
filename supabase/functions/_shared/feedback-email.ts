import { z } from "zod";
import { type admin, env, HttpError } from "./http.ts";
import { escapeHtml } from "./email.ts";

const mailRow = z.object({
  id: z.string().uuid(),
  kind: z.enum(["idea", "problem", "feedback"]),
  title: z.string().min(3).max(120),
  message: z.string().min(10).max(4000),
  reply_email: z.string().email().nullable(),
  platform: z.string().max(20),
  app_version: z.string().max(40),
  created_at: z.string(),
  email_lease_token: z.string().uuid(),
  email_attempts: z.number().int().min(1).max(8),
});
type FeedbackMail = z.infer<typeof mailRow>;
export const feedbackRecipient = "baltii.ahmed@gmail.com";

export function feedbackEmailContent(row: FeedbackMail) {
  const category =
    { idea: "Idea", problem: "Problem", feedback: "Feedback" }[row.kind];
  const subject = `[Subloom ${category}] ${row.title.replace(/[\r\n]+/g, " ")}`;
  const details = [
    ["Category", category],
    ["Reply email", row.reply_email || "Not provided"],
    ["Platform", row.platform],
    ["App version", row.app_version],
    ["Submitted", row.created_at],
    ["Feedback ID", row.id],
  ];
  return {
    subject,
    text: `${subject}\n\n${row.message}\n\n${
      details.map(([key, value]) => `${key}: ${value}`).join("\n")
    }`,
    html:
      `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#182D25;line-height:1.6;max-width:640px;margin:32px auto;padding:0 20px"><p>New ${category.toLowerCase()} for Subloom</p><h1 style="font-size:24px">${
        escapeHtml(row.title)
      }</h1><p style="white-space:pre-wrap;overflow-wrap:anywhere">${
        escapeHtml(row.message)
      }</p><hr><dl>${
        details.map(([key, value]) =>
          `<dt style="font-weight:bold">${
            escapeHtml(key!)
          }</dt><dd style="margin:0 0 12px">${escapeHtml(value!)}</dd>`
        ).join("")
      }</dl></body></html>`,
  };
}

export async function sendFeedbackEmail(row: FeedbackMail) {
  const content = feedbackEmailContent(row);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env("RESEND_API_KEY"),
      "Content-Type": "application/json",
      "Idempotency-Key": "subloom-feedback/" + row.id,
    },
    body: JSON.stringify({
      from: env("EMAIL_FROM"),
      to: [feedbackRecipient],
      ...content,
      ...(row.reply_email ? { reply_to: row.reply_email } : {}),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new HttpError(503, "Feedback email delivery is pending.");
  }
  return z.object({ id: z.string().min(1) }).parse(await response.json()).id;
}

export async function deliverFeedbackEmails(
  client: ReturnType<typeof admin>,
  targetId?: string,
) {
  const { data, error } = await client.rpc("claim_feedback_emails", {
    batch_size: targetId ? 1 : 5,
    target_id: targetId || null,
  });
  if (error) throw new HttpError(503, "Could not claim feedback emails.");
  const rows = z.array(mailRow).parse(data || []);
  let accepted = 0, pending = 0;
  for (const row of rows) {
    try {
      const providerId = await sendFeedbackEmail(row);
      const { data: saved, error: saveError } = await client.from(
        "app_feedback",
      ).update({
        email_sent_at: new Date().toISOString(),
        email_provider_id: providerId,
        email_lease_until: null,
        email_lease_token: null,
        email_error: null,
      }).eq("id", row.id).eq("email_lease_token", row.email_lease_token).is(
        "email_sent_at",
        null,
      ).select("id").maybeSingle();
      if (saveError || !saved) {
        throw new Error("Could not record feedback email acceptance.");
      }
      accepted++;
    } catch {
      pending++;
      const seconds = Math.min(3600, 30 * 2 ** (row.email_attempts - 1));
      const { error: saveError } = await client.from("app_feedback").update({
        email_next_attempt_at: new Date(Date.now() + seconds * 1000)
          .toISOString(),
        email_lease_until: null,
        email_lease_token: null,
        email_error: row.email_attempts >= 8
          ? "email_delivery_failed"
          : "email_delivery_pending",
      }).eq("id", row.id).eq("email_lease_token", row.email_lease_token).is(
        "email_sent_at",
        null,
      );
      if (saveError) {
        throw new HttpError(503, "Could not record feedback email retry.");
      }
    }
  }
  return { accepted, pending };
}
