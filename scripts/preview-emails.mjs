import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Previews use illustrative data and never load credentials or send emails.
const source = `
import { subscription } from './tests/fixtures.ts';
import { emailTemplate, emailText } from './supabase/functions/_shared/email.ts';
import { subscriptionNotification, weeklyDigestNotification, welcomeNotification, receiptDetectedNotification } from './supabase/functions/_shared/notification-emails.ts';
const s = subscription({nextRenewal:'2026-10-14', paidThrough:'2026-10-31'});
const messages = [
  subscriptionNotification('subscription_added', s),
  subscriptionNotification('renewal_upcoming', s, {daysBefore:3}),
  subscriptionNotification('renewal_today', s, {eventDate:'2026-10-11',daysBefore:0}),
  subscriptionNotification('payment_overdue', s, {eventDate:'2026-10-09'}),
  subscriptionNotification('trial_ending', s, {eventDate:'2026-10-12',daysBefore:1}),
  subscriptionNotification('price_change', s, {oldAmountMinor:999}),
  subscriptionNotification('cancellation', s),
  weeklyDigestNotification(2, ['USD 28.98/month estimated'], ['Spotify · Oct 14 · USD 10.99', 'Netflix · Oct 16 · USD 17.99']),
  welcomeNotification(),
  receiptDetectedNotification('Spotify', s.id),
];
console.log(JSON.stringify(messages.map(m => {
  const content = {title:m.title, body:m.body, preview:m.email.preview, action:m.email.action, url:'subloom://'+m.path, presentation:m.email};
  return {name:m.email.template, title:m.title, html:emailTemplate(content), text:emailText(content)};
})));`;
const previews = JSON.parse(
  execFileSync(
    "node_modules/.bin/deno",
    ["eval", "--config", "supabase/functions/deno.json", source],
    { encoding: "utf8" },
  ),
);
const directory = resolve("build/email-templates");
mkdirSync(directory, { recursive: true });
for (const preview of previews) {
  writeFileSync(resolve(directory, preview.name + ".html"), preview.html);
  writeFileSync(resolve(directory, preview.name + ".txt"), preview.text);
}
const labels = {
  subscription_added: "Subscription added",
  renewal_upcoming: "Upcoming renewal",
  renewal_today: "Renewal today",
  payment_overdue: "Past tracked due date",
  trial_ending: "Trial ending",
  price_change: "Price change",
  cancellation: "Cancellation recorded",
  weekly_digest: "Weekly digest",
  welcome: "Welcome",
  receipt_detected: "Receipt detected",
};
writeFileSync(
  resolve(directory, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subloom email templates</title><style>
*{box-sizing:border-box}body{margin:0;background:#F8FAF8;color:#182D25;font:16px/1.6 Arial,Helvetica,sans-serif}main{max-width:1240px;margin:auto;padding:32px 24px}h1{font-size:32px;line-height:1.2;margin:0 0 12px}p{color:#526A5C;margin:0 0 24px}a{color:#087F68;text-underline-offset:4px}a:focus-visible{outline:2px solid #087F68;outline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:36px}.previews{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 24px}h2{font-size:20px;margin:0 0 12px}iframe{display:block;width:100%;height:1060px;border:1px solid #DCE6DF;background:#F5F8F5}section{min-width:0;scroll-margin-top:24px}@media(max-width:760px){main{padding:24px 12px}.previews{grid-template-columns:1fr}h1{font-size:28px}}
</style></head><body><main><h1>Subloom email templates</h1><p>Ten reusable notifications. All subscriptions, dates, and amounts below are illustrative preview data. These previews do not send email.</p><nav aria-label="Email templates">${previews.map((p) => `<a href="#${p.name}">${labels[p.name]}</a>`).join("")}</nav><div class="previews">${previews.map((p) => `<section id="${p.name}"><h2>${labels[p.name]}</h2><p><a href="${p.name}.html">Open email</a> · <a href="${p.name}.txt">Plain text</a></p><iframe title="${labels[p.name]} email preview" src="${p.name}.html"></iframe></section>`).join("")}</div></main></body></html>`,
);
console.log(
  "Created 10 HTML/plain-text previews: " + resolve(directory, "index.html"),
);
