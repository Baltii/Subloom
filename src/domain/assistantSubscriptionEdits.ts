import type { AssistantSubscriptionEdit } from "./assistantProtocol";
import {
  categories,
  currencies,
  dateSchema,
  intervals,
  statuses,
  subscriptionSchema,
  type Subscription,
} from "./models";
import { formatMoney, moneyInput, parseMoney } from "./money";
import { dateLabel, intervalLabel } from "./renewal";

type Changes = AssistantSubscriptionEdit["changes"];

function option<const T extends string>(
  choices: readonly T[],
  value: string,
  label: string,
): T {
  const found = choices.find(
    (choice) => choice.toLowerCase() === value.trim().toLowerCase(),
  );
  if (!found) throw new Error("Choose a valid " + label + ".");
  return found;
}

function validDate(value: string, label: string) {
  const date = dateSchema.safeParse(value).data;
  if (!date)
    throw new Error(
      "What is the " + label + "? Give me the day, month, and year.",
    );
  return date;
}

export function editAssistantSubscription(
  current: Subscription,
  changes: Changes,
  reference: string,
  paymentMethod?: string,
) {
  const patch = new Map(
    changes.map(({ field, value }) => [field, value] as const),
  );
  if (patch.size !== changes.length)
    throw new Error("Give me one value per field.");
  const edited = { ...current };
  for (const [field, value] of patch) {
    switch (field) {
      case "name":
        edited.name = value.trim();
        if (edited.name !== current.name) edited.serviceId = null;
        break;
      case "category":
        edited.category = option(categories, value, "category");
        break;
      case "currency":
        edited.currency = option(currencies, value, "currency");
        break;
      case "interval":
        edited.interval = option(intervals, value, "billing frequency");
        break;
      case "intervalCount":
        if (!/^[1-9]\d{0,2}$/.test(value) || Number(value) > 365)
          throw new Error("Enter a billing interval count from 1 to 365.");
        edited.intervalCount = Number(value);
        break;
      case "customUnit":
        edited.customUnit = option(
          ["day", "week", "month", "year"],
          value,
          "custom billing unit",
        );
        break;
      case "startDate":
        edited.startDate = validDate(value, "start date");
        break;
      case "nextRenewal":
        edited.nextRenewal = validDate(value, "next renewal date");
        if (edited.nextRenewal !== current.nextRenewal)
          edited.anchorDay = Number(edited.nextRenewal.slice(-2));
        break;
      case "status":
        edited.status = option(statuses, value, "tracking status");
        if (edited.status !== current.status) {
          edited.canceledAt = edited.status === "canceled" ? reference : null;
          edited.paidThrough = null;
        }
        break;
      case "trialEnd":
        edited.trialEnd = value ? validDate(value, "trial end date") : null;
        break;
      case "notes":
        edited.notes = value;
        break;
      case "reminderDays": {
        if (value && !/^\d{1,2}(?:\s*,\s*\d{1,2}){0,9}$/.test(value))
          throw new Error(
            "Give me the reminder offsets as days before renewal.",
          );
        const days = value ? [...new Set(value.split(",").map(Number))] : [];
        if (days.some((day) => day > 30))
          throw new Error("Reminder offsets can range from 0 to 30 days.");
        edited.reminders = { enabled: edited.reminders?.enabled ?? true, days };
        break;
      }
      case "remindersEnabled":
        if (!["true", "false"].includes(value))
          throw new Error("Should reminders be on or off?");
        edited.reminders = {
          enabled: value === "true",
          days: edited.reminders?.days ?? [],
        };
        break;
      case "paidThrough":
      case "price":
      case "paymentMethod":
        break;
    }
  }
  if (patch.has("paidThrough")) {
    const value = patch.get("paidThrough");
    if (value && edited.status !== "canceled")
      throw new Error(
        "A paid-through date applies to a canceled subscription.",
      );
    edited.paidThrough = value ? validDate(value, "paid-through date") : null;
  }
  if (patch.has("price") || edited.currency !== current.currency) {
    try {
      edited.amountMinor = parseMoney(
        patch.get("price") ?? moneyInput(current.amountMinor, current.currency),
        edited.currency,
      );
    } catch {
      throw new Error("What is the exact price in " + edited.currency + "?");
    }
  }
  if (paymentMethod !== undefined) edited.paymentMethod = paymentMethod;
  if (edited.nextRenewal < edited.startDate)
    throw new Error(
      "Which date should be the next renewal? It must be on or after the start date.",
    );
  if (
    edited.status === "trial" &&
    (!edited.trialEnd || edited.trialEnd < edited.startDate)
  )
    throw new Error(
      "When does the trial end? Choose a date on or after the start date.",
    );
  if (edited.status !== "trial") edited.trialEnd = null;
  const parsed = subscriptionSchema.safeParse(edited);
  if (!parsed.success)
    throw new Error("Check the subscription details or open the edit form.");
  return parsed.data;
}

export function assistantSubscriptionRows(
  before: Subscription,
  after: Subscription,
) {
  const rows: { label: string; value: string }[] = [];
  const date = (value: string | null) =>
    value
      ? dateLabel(value, { month: "short", day: "numeric", year: "numeric" })
      : "Cleared";
  if (before.name !== after.name)
    rows.push({ label: "Name", value: after.name });
  if (before.category !== after.category)
    rows.push({ label: "Category", value: after.category });
  if (
    before.amountMinor !== after.amountMinor ||
    before.currency !== after.currency
  )
    rows.push({
      label: "Price",
      value:
        formatMoney(after.amountMinor, after.currency) + " · " + after.currency,
    });
  if (
    before.interval !== after.interval ||
    before.intervalCount !== after.intervalCount ||
    before.customUnit !== after.customUnit
  )
    rows.push({ label: "Billing schedule", value: intervalLabel(after) });
  if (before.startDate !== after.startDate)
    rows.push({ label: "Start date", value: date(after.startDate) });
  if (before.nextRenewal !== after.nextRenewal)
    rows.push({ label: "Next renewal", value: date(after.nextRenewal) });
  if (before.status !== after.status)
    rows.push({ label: "Tracking status", value: after.status });
  if (before.trialEnd !== after.trialEnd)
    rows.push({ label: "Trial ends", value: date(after.trialEnd) });
  if (before.paidThrough !== after.paidThrough)
    rows.push({ label: "Paid through", value: date(after.paidThrough) });
  if (before.notes !== after.notes)
    rows.push({ label: "Notes", value: after.notes || "Cleared" });
  if (JSON.stringify(before.reminders) !== JSON.stringify(after.reminders))
    rows.push({
      label: "Subscription reminders",
      value: after.reminders?.enabled
        ? after.reminders.days
            .map((day) => (day ? day + " days before" : "On renewal day"))
            .join(", ") || "Enabled"
        : "Off",
    });
  return rows;
}
