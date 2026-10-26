import { z } from "zod";
import type { Subscription } from "../../../src/domain/models.ts";
import { formatMoney } from "../../../src/domain/money.ts";
import { dateLabel } from "../../../src/domain/renewal.ts";

export const emailSubscriptionSchema = z.object({
  name: z.string().max(80),
  serviceId: z.string().max(80).nullable().optional(),
  date: z.string().max(40),
  amount: z.string().max(120),
  cycle: z.string().max(80),
  kind: z.enum(["renewal", "trial"]),
  path: z.string().regex(/^\/subscription\/[0-9a-f-]{36}$/i),
});

export const emailPresentationSchema = z.object({
  template: z.enum([
    "subscription_added",
    "renewal_upcoming",
    "renewal_today",
    "payment_overdue",
    "trial_ending",
    "plan_ending",
    "price_change",
    "cancellation",
    "weekly_digest",
    "welcome",
    "receipt_detected",
  ]),
  action: z.string().min(1).max(80),
  preview: z.string().max(240),
  tone: z.enum(["green", "amber", "red"]).default("green"),
  details: z.array(
    z.object({ label: z.string().max(80), value: z.string().max(240) }),
  ).max(12).default([]),
  items: z.array(z.string().max(300)).max(15).default([]),
  subscriptions: z.array(emailSubscriptionSchema).max(10000).optional(),
  weeklyTotal: z.string().max(120).optional(),
  period: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
});
export type EmailPresentation = z.infer<typeof emailPresentationSchema>;
export type NotificationMessage = {
  title: string;
  body: string;
  path: string;
  email: EmailPresentation;
};
export type SubscriptionEmailKind = Extract<
  EmailPresentation["template"],
  | "subscription_added"
  | "renewal_upcoming"
  | "renewal_today"
  | "payment_overdue"
  | "trial_ending"
  | "plan_ending"
  | "price_change"
  | "cancellation"
>;

function money(amount: number, subscription: Subscription) {
  return formatMoney(amount, subscription.currency) + " " +
    subscription.currency;
}
function billingCycle(s: Subscription) {
  const units = {
    weekly: "week",
    monthly: "month",
    quarterly: "month",
    yearly: "year",
    custom: s.customUnit,
  };
  const count = s.interval === "quarterly"
    ? 3 * s.intervalCount
    : s.intervalCount;
  const unit = units[s.interval];
  return `Every ${count === 1 ? "" : count + " "}${unit}${
    count === 1 ? "" : "s"
  }`;
}

/** Lifecycle templates are reusable; callers must supply a verified event before sending. */
export function subscriptionNotification(
  kind: SubscriptionEmailKind,
  s: Subscription,
  options: {
    eventDate?: string;
    daysBefore?: number;
    oldAmountMinor?: number;
    highRenewal?: boolean;
  } = {},
): NotificationMessage {
  const date = dateLabel(options.eventDate ?? s.nextRenewal, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const amount = money(s.amountMinor, s);
  const when = options.daysBefore === 1
    ? "tomorrow"
    : options.daysBefore === 0
    ? "today"
    : options.daysBefore !== undefined
    ? `in ${options.daysBefore} days`
    : "soon";
  const details = [
    { label: "Subscription", value: s.name },
    { label: "Tracked amount", value: amount },
    { label: "Billing cycle", value: billingCycle(s) },
    { label: "Renewal date", value: date },
  ];
  let title: string, body: string, action = "View subscription";
  let tone: EmailPresentation["tone"] = "green";
  let note =
    "Based on your tracked schedule. Check your provider for the actual charge and payment status.";
  switch (kind) {
    case "subscription_added":
      title = `${s.name} is now in your Subloom.`;
      body =
        "Your subscription is saved. Review its billing details and choose when you’d like a reminder.";
      action = "Review subscription";
      break;
    case "renewal_upcoming":
      title = `${s.name} renews ${when}.`;
      body =
        `${amount} is scheduled for ${s.name} on ${date}. Take a moment to review your plan before its next billing date.`;
      if (options.highRenewal) {
        title = `High upcoming renewal · ${s.name}`;
        tone = "amber";
      }
      action = "Review renewal";
      break;
    case "renewal_today":
      title = `${s.name} is due to renew today.`;
      body =
        `Today is the renewal date you’ve tracked for ${s.name}, at ${amount}. Check your provider if you want to confirm the charge or make a change.`;
      action = "View renewal details";
      break;
    case "payment_overdue":
      title = `Check the payment status for ${s.name}.`;
      body =
        `The tracked due date of ${date} has passed. Check your provider to see whether a payment is still outstanding, then update your subscription if needed.`;
      details[3] = { label: "Tracked due date", value: date };
      tone = "red";
      action = "Review payment status";
      note =
        "Subloom cannot verify a failed or overdue payment. This reminder refers only to the date you’ve tracked.";
      break;
    case "trial_ending":
      title = `Your ${s.name} trial ends ${when}.`;
      body =
        `Your trial ends on ${date}. Review the provider’s terms and decide whether you’d like to keep the plan before billing begins.`;
      details[1] = { label: "Tracked post-trial amount", value: amount };
      details[3] = { label: "Trial ends", value: date };
      tone = "amber";
      action = "Review trial";
      break;
    case "plan_ending":
      title = `Your ${s.name} plan ends ${when}.`;
      body =
        `Your access ends on ${date}. Renewal is canceled, so there is no upcoming renewal charge. Your tracked records stay saved when Pro ends.`;
      details.splice(1);
      details.push({ label: "Access ends", value: date });
      action = "Review your plan";
      tone = "amber";
      break;
    case "price_change":
      title = `The tracked price for ${s.name} changed.`;
      body =
        "Your subscription’s tracked price has been updated. Review the amount and next renewal date to keep your spending estimate current.";
      if (options.oldAmountMinor !== undefined) {
        details.splice(1, 0, {
          label: "Previous tracked amount",
          value: money(options.oldAmountMinor, s),
        });
      }
      action = "Review price change";
      break;
    case "cancellation":
      title = `Cancellation recorded for ${s.name}.`;
      body =
        "You’ve recorded this subscription as canceled in Subloom. Keep any cancellation confirmation from your provider for your records.";
      details.splice(1);
      if (s.paidThrough) {
        details.push({
          label: "Tracked access until",
          value: dateLabel(s.paidThrough, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        });
      }
      note =
        "Recording a cancellation in Subloom does not cancel billing with the provider.";
      action = "View subscription record";
      break;
  }
  return {
    title,
    body,
    path: "/subscription/" + s.id,
    email: {
      template: kind,
      action,
      preview: body.slice(0, 240),
      tone,
      details,
      items: [],
      note,
    },
  };
}

export function weeklyDigestNotification(
  count: number,
  total: string,
  renewals: z.infer<typeof emailSubscriptionSchema>[],
  period?: string,
): NotificationMessage {
  const body = count === 0
    ? "A quiet week ahead. You have no renewals scheduled in the next 7 days."
    : `${count} ${
      count === 1 ? "renewal" : "renewals"
    } coming up in the next 7 days. Here’s your week at a glance.`;
  return {
    title: "Your subscriptions this week.",
    body,
    path: "/",
    email: {
      template: "weekly_digest",
      preview: body,
      action: "Review my week",
      tone: "green",
      details: [],
      items: [],
      subscriptions: renewals,
      weeklyTotal: total,
      period,
      note: count === 0
        ? "No renewals are scheduled in the next 7 days."
        : "Dates and amounts reflect your tracked subscriptions. Check your providers for actual charges.",
    },
  };
}

export function welcomeNotification(): NotificationMessage {
  return {
    title: "A little clarity starts here.",
    body:
      "Welcome to Subloom. Add the subscriptions you use, see your recurring costs, and choose the reminders that suit you. Your data stays yours.",
    path: "/",
    email: {
      template: "welcome",
      preview: "Welcome to your personal subscription space.",
      action: "Open my space",
      tone: "green",
      details: [],
      items: [],
    },
  };
}

export function receiptDetectedNotification(
  merchant: string,
  id: string,
): NotificationMessage {
  const body =
    `A forwarded receipt may contain a subscription from ${merchant}. Review the detected details before adding or updating your subscription.`;
  return {
    title: "A receipt worth a look.",
    body,
    path: "/detection/" + id,
    email: {
      template: "receipt_detected",
      preview: body.slice(0, 240),
      action: "Review receipt",
      tone: "green",
      details: [{ label: "Detected merchant", value: merchant }],
      items: [],
      note:
        "Receipt detection can be incomplete. You choose which details to save.",
    },
  };
}
