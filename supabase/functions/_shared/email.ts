import type { EmailPresentation } from "./notification-emails.ts";
import {
  appWebBase,
  notificationWebUrl,
} from "../../../src/domain/appLinks.ts";
import { serviceFor } from "../../../src/domain/catalog.ts";

// One message, one illustration. Keep this exhaustive as new templates are added.
export const emailIllustrations: Record<EmailPresentation["template"], string> =
  {
    subscription_added: "illustrations/subscription-added",
    renewal_upcoming: "illustrations/renewal-upcoming",
    renewal_today: "illustrations/renewal-today",
    payment_overdue: "illustrations/payment-overdue",
    trial_ending: "illustrations/trial-ending",
    plan_ending: "illustrations/plan-ending",
    price_change: "illustrations/price-change",
    cancellation: "illustrations/cancellation",
    weekly_digest: "illustrations/weekly-digest",
    welcome: "illustrations/welcome",
    receipt_detected: "illustrations/receipt-detected",
  };

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}
export type EmailContent = {
  title: string;
  preview: string;
  body: string;
  action: string;
  url: string;
  preferencesUrl?: string;
  presentation?: EmailPresentation;
  webBase?: string;
  illustration?: "auth-otp" | "auth-security";
};
export function emailTemplate(content: EmailContent) {
  const p = content.presentation;
  const base = appWebBase(content.webBase);
  const asset = (name: string) => `${base}/email/${name}.png`;
  const accent = p?.tone === "red"
    ? "#A13232"
    : p?.tone === "amber"
    ? "#805400"
    : "#087C65";
  const illustration = content.illustration
    ? `illustrations/${content.illustration}`
    : emailIllustrations[p?.template ?? "welcome"];
  const details = p?.details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">${
      p.details.map(({ label, value }) =>
        `<tr><td width="42%" valign="top" style="padding:12px 12px 12px 0;border-bottom:1px solid #E8EEE9;color:#586F61;font-size:14px;line-height:1.5">${
          escapeHtml(label)
        }</td><td valign="top" style="padding:12px 0;border-bottom:1px solid #E8EEE9;font-size:14px;line-height:1.5;font-weight:bold;overflow-wrap:anywhere;word-break:break-word">${
          escapeHtml(value)
        }</td></tr>`
      ).join("")
    }</table>`
    : "";
  const items = p?.items.length
    ? `<ul style="margin:24px 0 0;padding-left:20px;color:#586F61;font-size:14px;line-height:1.7">${
      p.items.map((item) =>
        `<li style="padding-bottom:10px;overflow-wrap:anywhere">${
          escapeHtml(item)
        }</li>`
      ).join("")
    }</ul>`
    : "";
  const total = p?.weeklyTotal !== undefined
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#E1F0DE;border-radius:16px"><tr><td style="padding:22px 20px"><p style="margin:0 0 8px;font-size:14px;color:#344F3E">This week’s estimate${
      p.period ? ` · ${escapeHtml(p.period)}` : ""
    }</p><p style="margin:0;font-size:30px;line-height:1.25;font-weight:bold;letter-spacing:-0.5px">${
      escapeHtml(p.weeklyTotal)
    }</p></td></tr></table>`
    : "";
  const rows = p?.subscriptions?.length
    ? `<h2 style="font-size:18px;line-height:1.4;margin:28px 0 8px">Your week ahead</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${
      p.subscriptions.map((item) => {
        const service = serviceFor(item.serviceId ?? null);
        const icon = service && service.glyph !== "gym"
          ? `<img src="${
            asset(`services/${service.id}`)
          }" width="40" height="40" alt="" style="display:block;border:0;border-radius:12px">`
          : `<span style="display:block;text-align:center;width:40px;line-height:40px;font-size:19px;font-weight:bold;background:#E1F0DE;color:#087C65;border-radius:12px">${
            escapeHtml(item.name.charAt(0).toUpperCase())
          }</span>`;
        const href = escapeHtml(notificationWebUrl(item.path, base));
        return `<tr><td width="52" valign="middle" style="padding:16px 0;border-bottom:1px solid #E8EEE9">${icon}</td><td valign="middle" style="padding:16px 10px 16px 0;border-bottom:1px solid #E8EEE9;overflow-wrap:anywhere;word-break:break-word"><a href="${href}" style="font-size:15px;line-height:1.5;font-weight:bold;color:#182D25;text-decoration:none">${
          escapeHtml(item.name)
        }</a><p style="margin:4px 0 0;color:#586F61;font-size:12px;line-height:1.5">${
          escapeHtml(item.date)
        }${
          item.kind === "trial" ? " · Trial ends" : ""
        }</p></td><td align="right" valign="middle" style="padding:16px 0;border-bottom:1px solid #E8EEE9"><p style="margin:0;font-size:14px;font-weight:bold;line-height:1.5">${
          escapeHtml(item.amount)
        }</p><p style="margin:4px 0 0;color:#586F61;font-size:12px;line-height:1.5">${
          escapeHtml(item.cycle)
        }</p></td></tr>`;
      }).join("")
    }</table>`
    : "";
  const url = escapeHtml(content.url);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${
    escapeHtml(content.title)
  }</title></head><body style="margin:0;padding:0;background:#F8FAF8;color:#182D25;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${
    escapeHtml(content.preview)
  }</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:4px 20px 28px"><a href="${
    escapeHtml(notificationWebUrl("/", base))
  }" style="text-decoration:none"><img src="${
    asset("logo")
  }" width="173" height="32" alt="Subloom" style="display:block;border:0"></a></td></tr><tr><td style="padding:28px 20px;background:#FFFFFF;border-radius:20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 24px"><img src="${
    asset(illustration)
  }" width="144" alt="" style="display:block;width:144px;max-width:100%;height:auto;border:0"></td></tr></table><h1 style="font-size:26px;line-height:1.3;letter-spacing:-0.5px;margin:0 0 16px;font-weight:bold;overflow-wrap:anywhere;word-break:break-word">${
    escapeHtml(content.title)
  }</h1><p style="font-size:16px;line-height:1.7;color:#586F61;margin:0;overflow-wrap:anywhere;word-break:break-word">${
    escapeHtml(content.body)
  }</p>${total}${rows}${details}${items}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 16px"><tr><td align="center" bgcolor="${accent}" style="border-radius:28px;mso-padding-alt:16px 24px"><a href="${url}" target="_blank" style="display:inline-block;border:1px solid ${accent};background:${accent};color:#FFFFFF;text-decoration:none;border-radius:28px;padding:15px 24px;font-size:15px;line-height:1.5;font-weight:bold;mso-padding-alt:0">${
    escapeHtml(content.action)
  }</a></td></tr></table><p style="font-size:12px;line-height:1.6;color:#586F61;margin:0 0 24px">Button not opening? <a href="${url}" style="color:#087C65;text-decoration:underline">Use this link to Subloom</a>.</p>${
    p?.note
      ? `<p style="font-size:13px;line-height:1.7;color:#586F61;margin:0">${
        escapeHtml(p.note)
      }</p>`
      : ""
  }</td></tr><tr><td style="padding:24px 20px"><p style="font-size:13px;line-height:1.7;color:#586F61;margin:0 0 12px">A little clarity for your recurring world.</p><p style="font-size:12px;line-height:1.7;color:#586F61;margin:0">Sent with care, from Subloom.<br>Your subscription information is never used for advertising.<br><a href="${
    escapeHtml(notificationWebUrl("/settings", base))
  }" style="color:#087C65">Email preferences</a>${
    content.preferencesUrl
      ? ` · <a href="${
        escapeHtml(content.preferencesUrl)
      }" style="color:#087C65">Stop weekly digests</a>`
      : ""
  }</p></td></tr></table></td></tr></table></body></html>`;
}

export function emailText(content: EmailContent) {
  return [
    content.title,
    content.body,
    content.presentation?.weeklyTotal !== undefined
      ? `This week’s estimate${
        content.presentation.period ? ` (${content.presentation.period})` : ""
      }: ${content.presentation.weeklyTotal}`
      : undefined,
    ...(content.presentation?.subscriptions?.map((item) =>
      `${item.name} · ${item.date}${
        item.kind === "trial" ? " · Trial ends" : ""
      } · ${item.amount} / ${item.cycle}\n${
        notificationWebUrl(item.path, content.webBase)
      }`
    ) ?? []),
    ...(content.presentation?.details.map(({ label, value }) =>
      `${label}: ${value}`
    ) ?? []),
    ...(content.presentation?.items ?? []),
    content.presentation?.note,
    `${content.action}: ${content.url}`,
    `Email preferences: ${notificationWebUrl("/settings", content.webBase)}`,
    content.preferencesUrl
      ? `Stop weekly digests: ${content.preferencesUrl}`
      : undefined,
  ].filter(Boolean).join("\n\n");
}
export function welcomeContent(url: string): EmailContent {
  return {
    title: "A little clarity starts here.",
    preview: "Welcome to your personal subscription space.",
    body:
      "Welcome to Subloom. Add the subscriptions you use, see your recurring costs, and choose the reminders that suit you. Your data stays yours.",
    action: "Open my space",
    url,
  };
}
export function verificationTemplate() {
  return emailTemplate({
    title: "Your sign-in code",
    preview: "Use this code to securely connect your account.",
    body:
      "Your one-time Subloom code is: {{ .Token }}. If you did not request it, you can ignore this email.",
    action: "Open Subloom",
    url: notificationWebUrl("/"),
    illustration: "auth-otp",
  });
}
