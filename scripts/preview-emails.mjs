import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Previews use illustrative data and never load credentials or send emails.
const source = `
import { subscription } from './tests/fixtures.ts';
import { emailTemplate, emailText } from './supabase/functions/_shared/email.ts';
import { subscriptionNotification, welcomeNotification, receiptDetectedNotification } from './supabase/functions/_shared/notification-emails.ts';
import { weeklyDigest } from './supabase/functions/_shared/weekly-digest.ts';
import { notificationWebUrl } from './src/domain/appLinks.ts';
const s = subscription({nextRenewal:'2026-10-14', anchorDay:14, paidThrough:'2026-10-31'});
const messages = [
  subscriptionNotification('subscription_added', s),
  subscriptionNotification('renewal_upcoming', s, {daysBefore:3}),
  subscriptionNotification('renewal_today', s, {eventDate:'2026-10-11',daysBefore:0}),
  subscriptionNotification('payment_overdue', s, {eventDate:'2026-10-09'}),
  subscriptionNotification('trial_ending', s, {eventDate:'2026-10-12',daysBefore:1}),
  subscriptionNotification('plan_ending', s, {eventDate:'2026-10-31'}),
  subscriptionNotification('price_change', s, {oldAmountMinor:999}),
  subscriptionNotification('cancellation', s),
  weeklyDigest([s, subscription({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', serviceId:'netflix', name:'Netflix', amountMinor:1799, nextRenewal:'2026-10-16', anchorDay:16})], {timezone:'Africa/Tunis', currency:'USD'}, [], new Date('2026-10-12T08:00:00Z')),
  welcomeNotification(),
  receiptDetectedNotification('Spotify', s.id),
];
console.log(JSON.stringify(messages.map(m => {
  const content = {title:m.title, body:m.body, preview:m.email.preview, action:m.email.action, url:notificationWebUrl(m.path), presentation:m.email};
  return {name:m.email.template, title:m.title, html:emailTemplate(content), text:emailText(content)};
})));`;
const previews = JSON.parse(
  execFileSync(
    "node_modules/.bin/deno",
    ["eval", "--config", "supabase/functions/deno.json", source],
    { encoding: "utf8" },
  ),
);
for (const [name, title, text] of [
  [
    "auth_otp",
    "Email sign-in code",
    "Enter the one-time code in Subloom to connect your account. Illustration preview only; this code is not valid.",
  ],
  [
    "auth_security",
    "Account security",
    "A security-related account setting changed. Review the change in Subloom.",
  ],
]) {
  previews.push({
    name,
    title,
    text,
    html: readFileSync(
      resolve("supabase/templates/" + name.replaceAll("_", "-") + ".html"),
      "utf8",
    ).replace("{{ .Token }}", "482619"),
  });
}
const directory = resolve("build/email-templates");
mkdirSync(directory, { recursive: true });
cpSync(resolve("public/email"), resolve(directory, "email"), {
  recursive: true,
});
for (const preview of previews) {
  writeFileSync(
    resolve(directory, preview.name + ".html"),
    preview.html.replaceAll("https://subloom.baltii.tn/email/", "/email/"),
  );
  writeFileSync(resolve(directory, preview.name + ".txt"), preview.text);
}
const labels = {
  subscription_added: "Subscription added",
  renewal_upcoming: "Upcoming renewal",
  renewal_today: "Renewal today",
  payment_overdue: "Past tracked due date",
  trial_ending: "Trial ending",
  plan_ending: "Plan ending",
  price_change: "Price change",
  cancellation: "Cancellation recorded",
  weekly_digest: "Weekly digest",
  welcome: "Welcome",
  receipt_detected: "Receipt detected",
  auth_otp: "Email sign-in code",
  auth_security: "Account security",
};
const meanings = {
  subscription_added: "A new subscription, neatly saved.",
  renewal_upcoming: "A gentle heads-up before renewal.",
  renewal_today: "A recurring payment due today.",
  payment_overdue: "Time to check the tracked payment status.",
  trial_ending: "A little time left to decide.",
  plan_ending: "Your membership is approaching its end.",
  price_change: "Compare the old and new tracked price.",
  cancellation: "Disconnected and filed for your records.",
  weekly_digest: "The coming week, gathered into one clear view.",
  welcome: "A fresh start for your recurring world.",
  receipt_detected: "A receipt with details worth reviewing.",
  auth_otp: "One private code to open your space.",
  auth_security: "A change to your protected account settings.",
};
writeFileSync(
  resolve(directory, "illustrations.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subloom email illustrations</title><style>
*{box-sizing:border-box}body{margin:0;background:#F8FAF8;color:#182D25;font:16px/1.6 Arial,Helvetica,sans-serif}main{max-width:1100px;margin:auto;padding:36px 24px}h1{font-size:30px;line-height:1.2;margin:0 0 12px}p{color:#586F61}a{color:#087C65;text-underline-offset:4px}a:focus-visible{outline:2px solid #087C65;outline-offset:4px}.art{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:28px}.art a{display:flex;flex-direction:column;align-items:center;padding:20px 14px;background:white;border-radius:16px;text-decoration:none;color:#182D25;text-align:center}.art img{width:144px;height:144px;object-fit:contain;margin-bottom:16px}.art strong{font-size:15px}.art span{font-size:12px;line-height:1.5;color:#586F61;margin-top:6px}@media(max-width:760px){main{padding:24px 16px}.art{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.art img{width:112px;height:112px}.art a{padding:16px 8px}}
</style></head><body><main><h1>Every email has its own story.</h1><p>${previews.length} distinct illustrations in Subloom’s forest, emerald, mint, and white. <a href="index.html">Browse the emails</a>.</p><div class="art">${previews.map((p) => `<a href="${p.name}.html"><img src="/email/illustrations/${p.html.match(/\/email\/illustrations\/([^"\s]+)/)?.[1]}" alt="${meanings[p.name]}"><strong>${labels[p.name]}</strong><span>${meanings[p.name]}</span></a>`).join("")}</div></main></body></html>`,
);
writeFileSync(
  resolve(directory, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subloom email templates</title><style>
*{box-sizing:border-box}body{margin:0;background:#F8FAF8;color:#182D25;font:16px/1.6 Arial,Helvetica,sans-serif}main{max-width:1240px;margin:auto;padding:32px 24px}h1{font-size:32px;line-height:1.2;margin:0 0 12px}p{color:#526A5C;margin:0 0 24px}a{color:#087F68;text-underline-offset:4px}a:focus-visible{outline:2px solid #087F68;outline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:36px}.previews{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 24px}h2{font-size:20px;margin:0 0 12px}iframe{display:block;width:100%;height:1060px;border:1px solid #DCE6DF;background:#F5F8F5}section{min-width:0;scroll-margin-top:24px}@media(max-width:760px){main{padding:24px 12px}.previews{grid-template-columns:1fr}h1{font-size:28px}}
</style></head><body><main><h1>Subloom email templates</h1><p>${previews.length} email designs, each with its own illustration. All subscriptions, dates, and amounts below are illustrative preview data. These previews do not send email. <a href="illustrations.html">View the illustration set</a>.</p><nav aria-label="Email templates">${previews.map((p) => `<a href="#${p.name}">${labels[p.name]}</a>`).join("")}</nav><div class="previews">${previews.map((p) => `<section id="${p.name}"><h2>${labels[p.name]}</h2><p><a href="${p.name}.html">Open email</a> · <a href="${p.name}.txt">Plain text</a></p><iframe title="${labels[p.name]} email preview" src="${p.name}.html"></iframe></section>`).join("")}</div></main></body></html>`,
);
console.log(
  `Created ${previews.length} HTML/plain-text previews: ` +
    resolve(directory, "index.html"),
);
