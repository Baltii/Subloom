import { z } from "zod";

export const currencies = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "TND",
  "JPY",
  "CHF",
  "AED",
  "INR",
] as const;
export const categories = [
  "Entertainment",
  "Music",
  "Productivity",
  "Cloud & storage",
  "Health & fitness",
  "Education",
  "Other",
] as const;
export const intervals = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
] as const;
export const statuses = [
  "active",
  "trial",
  "paused",
  "canceled",
  "expired",
] as const;
export type Currency = (typeof currencies)[number];
export type Category = (typeof categories)[number];
export type Interval = (typeof intervals)[number];
export type Status = (typeof statuses)[number];
export type DateOnly = string;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T12:00:00Z");
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid date in YYYY-MM-DD format.");
export const reminderSchema = z.object({
  enabled: z.boolean(),
  days: z.array(z.number().int().min(0).max(30)).max(10),
});
export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  serviceId: z.string().nullable(),
  name: z.string().trim().min(1).max(80),
  category: z.enum(categories),
  amountMinor: z.number().int().min(0).max(1_000_000_000),
  currency: z.enum(currencies),
  interval: z.enum(intervals),
  intervalCount: z.number().int().min(1).max(365),
  customUnit: z.enum(["day", "week", "month", "year"]),
  startDate: dateSchema,
  nextRenewal: dateSchema,
  anchorDay: z.number().int().min(1).max(31),
  trialEnd: dateSchema.nullable(),
  canceledAt: dateSchema.nullable(),
  paidThrough: dateSchema.nullable(),
  status: z.enum(statuses),
  paymentMethod: z.string().max(80),
  notes: z.string().max(2000),
  source: z.enum([
    "manual",
    "receipt",
    "screenshot",
    "connected_email",
    "notification",
  ]),
  reminders: reminderSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(0),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export const candidateSchema = z.object({
  id: z.string().uuid(),
  merchant: z.string().max(80),
  serviceId: z.string().nullable(),
  amountMinor: z.number().int().min(0).max(1_000_000_000).nullable(),
  currency: z.enum(currencies).nullable(),
  interval: z.enum(intervals).nullable(),
  chargeDate: dateSchema.nullable(),
  nextRenewal: dateSchema.nullable(),
  trialEnd: dateSchema.nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["receipt", "screenshot", "connected_email"]),
  fingerprint: z.string().max(128),
  reference: z.string().max(160).nullable(),
  missingFields: z.array(z.string()).max(10),
  explanation: z.string().max(600),
  kind: z.enum([
    "new",
    "renewal",
    "price_change",
    "cancellation",
    "refund",
    "one_time",
    "unknown",
  ]),
  matchedSubscriptionId: z.string().uuid().nullable(),
  state: z.enum(["pending", "confirmed", "dismissed"]),
  createdAt: z.string(),
});
export type Candidate = z.infer<typeof candidateSchema>;
export const preferencesSchema = z.object({
  appearance: z.enum(["system", "light", "dark"]),
  currency: z.enum(currencies),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA timezone."),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  reminderDays: z.array(z.number().int().min(0).max(30)).max(10),
  reminderHour: z.number().int().min(0).max(23),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
  trialReminders: z.boolean(),
  weeklyDigest: z.boolean(),
  privacyMode: z.boolean(),
  highRenewalThresholdMinor: z
    .number()
    .int()
    .min(0)
    .max(1_000_000_000)
    .nullable()
    .default(null),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const activitySchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "created",
    "edited",
    "canceled",
    "paused",
    "resumed",
    "deleted",
    "detected",
    "dismissed",
    "confirmed",
    "reminder",
  ]),
  title: z.string().max(160),
  detail: z.string().max(300),
  targetId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type Activity = z.infer<typeof activitySchema>;
export type Operation = {
  id: string;
  entity: "subscription" | "candidate" | "preferences" | "confirmation";
  action: "put" | "delete";
  entityId: string;
  expectedVersion: number | null;
  payload: unknown;
  createdAt: string;
};
export type Snapshot = {
  schemaVersion: 1;
  subscriptions: Subscription[];
  candidates: Candidate[];
  activity: Activity[];
  preferences: Preferences;
  outbox: Operation[];
  onboarded: boolean;
  demo: boolean;
  lastSyncedAt: string | null;
};
export function defaultPreferences(): Preferences {
  return {
    appearance: "system",
    currency: "USD",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    pushEnabled: false,
    emailEnabled: false,
    reminderDays: [7, 3, 1, 0],
    reminderHour: 9,
    quietStart: 22,
    quietEnd: 8,
    trialReminders: true,
    weeklyDigest: false,
    privacyMode: true,
    highRenewalThresholdMinor: null,
  };
}
export function emptySnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    subscriptions: [],
    candidates: [],
    activity: [],
    preferences: defaultPreferences(),
    outbox: [],
    onboarded: false,
    demo: false,
    lastSyncedAt: null,
  };
}
