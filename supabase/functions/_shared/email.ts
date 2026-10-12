import type { EmailPresentation } from "./notification-emails.ts";

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
};
export function emailTemplate(content: EmailContent) {
  const p = content.presentation;
  const accent = p?.tone === "red"
    ? "#A13232"
    : p?.tone === "amber"
    ? "#805400"
    : "#087F68";
  const details = p?.details.length
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #DCE6DF;margin-top:28px">' +
      p.details.map(({ label, value }) =>
        '<tr><td width="42%" valign="top" style="padding:13px 12px 13px 0;border-bottom:1px solid #DCE6DF;color:#526A5C;font-size:14px;line-height:1.6">' +
        escapeHtml(label) +
        '</td><td valign="top" style="padding:13px 0;border-bottom:1px solid #DCE6DF;color:#182D25;font-size:14px;line-height:1.6;font-weight:bold;overflow-wrap:anywhere;word-break:break-word">' +
        escapeHtml(value) + "</td></tr>"
      ).join("") + "</table>"
    : "";
  const items = p?.items.length
    ? '<h2 style="font-size:18px;line-height:1.4;margin:28px 0 12px">Coming up this week</h2><ul style="margin:0;padding-left:20px;color:#526A5C;font-size:14px;line-height:1.7">' +
      p.items.map((item) =>
        '<li style="padding-bottom:10px;overflow-wrap:anywhere">' +
        escapeHtml(item) + "</li>"
      ).join("") + "</ul>"
    : "";
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' +
    escapeHtml(content.title) +
    '</title></head><body style="margin:0;padding:0;background:#F5F8F5;color:#182D25;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' +
    escapeHtml(content.preview) +
    '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:580px;background:#FFFFFF;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;color:#FFFFFF;background:#123B2E;border-radius:16px 16px 0 0;font-size:24px;line-height:1.4;font-weight:bold">subloom.</td></tr><tr><td style="padding:28px 24px"><h1 style="font-size:28px;line-height:1.3;margin:0 0 18px;font-weight:bold;overflow-wrap:anywhere;word-break:break-word">' +
    escapeHtml(content.title) +
    '</h1><p style="font-size:16px;line-height:1.7;color:#526A5C;margin:0;overflow-wrap:anywhere;word-break:break-word">' +
    escapeHtml(content.body) +
    "</p>" + details + items + '<p style="margin:28px 0"><a href="' +
    escapeHtml(content.url) +
    '" style="display:inline-block;background:' + accent +
    ';color:#FFFFFF;text-decoration:none;border-radius:8px;padding:14px 20px;font-size:15px;line-height:1.5;font-weight:bold">' +
    escapeHtml(content.action) +
    "</a></p>" +
    (p?.note
      ? '<p style="font-size:13px;line-height:1.7;color:#526A5C;margin:0 0 24px">' +
        escapeHtml(p.note) + "</p>"
      : "") +
    '<hr style="border:0;border-top:1px solid #DCE6DF;margin:28px 0 20px"><p style="font-size:12px;line-height:1.7;color:#526A5C;margin:0">Take control of your subscriptions.<br>You received this email because of your Subloom account preferences. Change delivery preferences in Settings. Your subscription information is never used for advertising.' +
    (content.preferencesUrl
      ? '<br><a style="color:#087F68" href="' +
        escapeHtml(content.preferencesUrl) +
        '">Stop weekly digests</a>'
      : "") +
    "</p></td></tr></table></td></tr></table></body></html>"
  );
}

export function emailText(content: EmailContent) {
  return [
    content.title,
    content.body,
    ...(content.presentation?.details.map(({ label, value }) =>
      `${label}: ${value}`
    ) ?? []),
    ...(content.presentation?.items ?? []),
    content.presentation?.note,
    `${content.action}: ${content.url}`,
    "Change delivery preferences in Subloom Settings.",
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
    url: "{{ .SiteURL }}",
  });
}
