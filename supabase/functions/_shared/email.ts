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
};
export function emailTemplate(content: EmailContent) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHtml(content.title) +
    '</title></head><body style="margin:0;background:#F5F8F5;color:#182D25;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">' +
    escapeHtml(content.preview) +
    '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" style="max-width:560px;background:white;border-radius:20px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px"><div style="font-size:25px;font-weight:700;color:#087F68">✦ subloom.</div><h1 style="font-size:25px;line-height:1.35;margin:32px 0 16px">' +
    escapeHtml(content.title) +
    '</h1><p style="font-size:16px;line-height:1.7;color:#526A5C">' +
    escapeHtml(content.body) +
    '</p><p style="margin:28px 0"><a href="' +
    escapeHtml(content.url) +
    '" style="display:inline-block;background:#087F68;color:white;text-decoration:none;border-radius:10px;padding:14px 22px;font-weight:bold">' +
    escapeHtml(content.action) +
    '</a></p><hr style="border:0;border-top:1px solid #E8EEE9;margin:32px 0"><p style="font-size:12px;line-height:1.6;color:#647A6B">Take control of your subscriptions.<br>You received this email because of your Subloom account preferences. Change delivery preferences in Settings. Your subscription information is never used for advertising.' +
    (content.preferencesUrl
      ? '<br><a style="color:#087F68" href="' +
        escapeHtml(content.preferencesUrl) +
        '">Stop weekly digests</a>'
      : "") +
    "</p></td></tr></table></td></tr></table></body></html>"
  );
}
export function welcomeContent(url: string): EmailContent {
  return {
    title: "A little clarity starts here.",
    preview: "Welcome to your personal subscription space.",
    body: "Welcome to Subloom. Add the subscriptions you use, see your recurring costs, and choose the reminders that suit you. Your data stays yours.",
    action: "Open my space",
    url,
  };
}
export function verificationTemplate() {
  return emailTemplate({
    title: "Your sign-in code",
    preview: "Use this code to securely connect your account.",
    body: "Your one-time Subloom code is: {{ .Token }}. If you did not request it, you can ignore this email.",
    action: "Open Subloom",
    url: "{{ .SiteURL }}",
  });
}
