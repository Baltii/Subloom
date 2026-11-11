import { z } from "zod/v4";
import { currencies } from "./models.ts";

const name = z.string().min(1).max(80);
const hour = z.number().int().min(0).max(23).nullable();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const emptyAction = <T extends string>(kind: T) =>
  z.strictObject({ kind: z.literal(kind) });

export const assistantRequestSchema = z.strictObject({
  messages: z.array(z.string().min(1).max(800)).min(1).max(4),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  protocol: z.literal(2).optional(),
});

const legacyActions = [
  emptyAction("help"),
  emptyAction("clarify"),
  emptyAction("upcoming"),
  emptyAction("list_subscriptions"),
  emptyAction("open_add_subscription"),
  emptyAction("list_billing"),
  emptyAction("manage_billing"),
  z.strictObject({
    kind: z.literal("open_reminders"),
    subscription: name.nullable(),
  }),
  z.strictObject({ kind: z.literal("subscription"), name }),
  z.strictObject({
    kind: z.literal("add_subscription"),
    name: name.nullable(),
    amount: z
      .string()
      .regex(/^\d{1,10}(\.\d{1,3})?$/)
      .nullable(),
    currency: z.enum(currencies).nullable(),
    interval: z.enum(["weekly", "monthly", "quarterly", "yearly"]).nullable(),
    start: date,
    renewal: date,
    method: z.string().max(80).nullable(),
  }),
  z.strictObject({
    kind: z.literal("preferences"),
    appearance: z.enum(["light", "dark", "system"]).nullable(),
    accent: z
      .enum([
        "green",
        "blue",
        "red",
        "violet",
        "orange",
        "yellow",
        "pink",
        "mono",
      ])
      .nullable(),
    currency: z.enum(currencies).nullable(),
  }),
  z.strictObject({
    kind: z.literal("reminders"),
    days: z
      .array(z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]))
      .max(4)
      .nullable(),
    hour,
    quietStart: hour,
    quietEnd: hour,
  }),
  z.strictObject({
    kind: z.literal("reminder_delivery"),
    setting: z.enum(["trialReminders", "emailEnabled"]),
    enabled: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal("assign_billing"),
    subscription: name,
    method: name.nullable(),
  }),
] as const;

export const subscriptionEditFields = [
  "name",
  "price",
  "currency",
  "category",
  "interval",
  "intervalCount",
  "customUnit",
  "startDate",
  "nextRenewal",
  "status",
  "trialEnd",
  "paidThrough",
  "notes",
  "paymentMethod",
  "reminderDays",
  "remindersEnabled",
] as const;

export const assistantLegacyResponseSchema = z.strictObject({
  action: z.discriminatedUnion("kind", legacyActions),
});

export const assistantResponseSchema = z.strictObject({
  action: z.discriminatedUnion("kind", [
    ...legacyActions,
    z.strictObject({
      kind: z.literal("edit_subscription"),
      subscription: name.nullable(),
      changes: z
        .array(
          z.strictObject({
            field: z.enum(subscriptionEditFields),
            value: z.string().max(800),
          }),
        )
        .max(16),
    }),
    z.strictObject({
      kind: z.literal("delete_subscription"),
      subscription: name.nullable(),
    }),
    z.strictObject({
      kind: z.literal("payment_method"),
      operation: z.enum(["add", "edit", "delete"]),
      method: name.nullable(),
      type: z.enum(["card", "wallet"]).nullable(),
      name: z.string().max(60).nullable(),
      brand: z.string().max(60).nullable(),
      last4: z
        .string()
        .regex(/^\d{4}$/)
        .nullable(),
    }),
    z.strictObject({
      kind: z.literal("analytics"),
      metric: z.enum([
        "spending",
        "renewals",
        "trials",
        "by_category",
        "most_expensive",
        "recurring",
      ]),
      period: z.enum([
        "this_month",
        "next_month",
        "this_year",
        "next_year",
        "dates",
      ]),
      from: date,
      through: date,
      subscription: name.nullable(),
    }),
  ]),
});

type AssistantModelAction = z.infer<typeof assistantResponseSchema>["action"];
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantDraft = Extract<
  AssistantModelAction,
  { kind: "add_subscription" }
> & { details?: AssistantSubscriptionEdit["changes"] };
export type AssistantAction =
  Exclude<AssistantModelAction, { kind: "add_subscription" }> | AssistantDraft;
export type AssistantSubscriptionEdit = Extract<
  AssistantModelAction,
  { kind: "edit_subscription" }
>;
export type AssistantBillingChange = Extract<
  AssistantAction,
  { kind: "payment_method" }
>;

export function mergeSubscriptionEdit(
  action: AssistantAction,
  previous?: AssistantSubscriptionEdit,
): AssistantAction {
  if (
    !previous ||
    action.kind !== "edit_subscription" ||
    (action.subscription &&
      previous.subscription &&
      action.subscription.toLowerCase() !== previous.subscription.toLowerCase())
  )
    return action;
  const changes = new Map(
    previous.changes.map(({ field, value }) => [field, value] as const),
  );
  for (const change of action.changes) changes.set(change.field, change.value);
  return {
    ...action,
    subscription: action.subscription ?? previous.subscription,
    changes: [...changes].map(([field, value]) => ({ field, value })),
  };
}

export function mergeBillingDraft(
  action: AssistantAction,
  previous?: AssistantBillingChange,
): AssistantAction {
  if (
    !previous ||
    action.kind !== "payment_method" ||
    action.operation !== previous.operation ||
    (action.method &&
      previous.method &&
      action.method.toLowerCase() !== previous.method.toLowerCase()) ||
    (action.type && previous.type && action.type !== previous.type)
  )
    return action;
  return {
    ...action,
    method: action.method ?? previous.method,
    type: action.type ?? previous.type,
    name: action.name ?? previous.name,
    brand: action.brand ?? previous.brand,
    last4: action.last4 ?? previous.last4,
  };
}

export function mergeAssistantDraft(
  action: AssistantAction,
  previous?: AssistantDraft,
): AssistantAction {
  if (!previous) return action;
  if (
    action.kind === "edit_subscription" &&
    (!action.subscription ||
      action.subscription.toLowerCase() === previous.name?.toLowerCase())
  ) {
    const updates: AssistantDraft = { ...previous };
    const details = new Map(
      previous.details?.map(({ field, value }) => [field, value] as const),
    );
    for (const change of action.changes) {
      if (change.field === "startDate") {
        if (change.value !== previous.start) updates.renewal = null;
        updates.start = change.value;
      }
      if (change.field === "price") updates.amount = change.value;
      if (change.field === "currency") {
        const currency = currencies.find(
          (code) => code === change.value.toUpperCase(),
        );
        if (currency) updates.currency = currency;
      }
      if (change.field === "paymentMethod") updates.method = change.value;
      if (change.field === "name") updates.name = change.value;
      if (
        change.field === "interval" &&
        (change.value === "weekly" ||
          change.value === "monthly" ||
          change.value === "quarterly" ||
          change.value === "yearly")
      ) {
        if (
          change.value !== previous.interval ||
          details.get("interval") === "custom"
        )
          updates.renewal = null;
        updates.interval = change.value;
        details.delete("intervalCount");
        details.delete("customUnit");
      }
      if (
        ![
          "startDate",
          "nextRenewal",
          "price",
          "currency",
          "paymentMethod",
          "name",
        ].includes(change.field)
      ) {
        if (change.field === "interval" && change.value !== "custom")
          details.delete("interval");
        else details.set(change.field, change.value);
      }
    }
    const explicitRenewal = action.changes.find(
      ({ field }) => field === "nextRenewal",
    );
    if (explicitRenewal) updates.renewal = explicitRenewal.value;
    if (details.size)
      updates.details = [...details].map(([field, value]) => ({
        field,
        value,
      }));
    else delete updates.details;
    return updates;
  }
  if (action.kind !== "add_subscription") return action;
  if (
    action.name &&
    previous.name &&
    action.name.trim().toLowerCase() !== previous.name.trim().toLowerCase()
  )
    return action;
  const datesChanged =
    (action.start && action.start !== previous.start) ||
    (action.interval && action.interval !== previous.interval);
  return {
    kind: "add_subscription",
    name: action.name ?? previous.name,
    amount: action.amount ?? previous.amount,
    currency: action.currency ?? previous.currency,
    interval: action.interval ?? previous.interval,
    start: action.start ?? previous.start,
    renewal: action.renewal ?? (datesChanged ? null : previous.renewal),
    method: action.method ?? previous.method,
    details: mergeDraftDetails(previous, action),
  };
}

function mergeDraftDetails(previous: AssistantDraft, action: AssistantDraft) {
  const details = new Map(
    previous.details?.map(({ field, value }) => [field, value] as const),
  );
  if (
    action.interval &&
    (action.interval !== previous.interval ||
      details.get("interval") === "custom")
  ) {
    details.delete("interval");
    details.delete("intervalCount");
    details.delete("customUnit");
  }
  for (const { field, value } of action.details ?? [])
    details.set(field, value);
  return details.size
    ? [...details].map(([field, value]) => ({ field, value }))
    : undefined;
}

// Keep obvious card numbers out of the provider request, including spaced input.
export function containsCardNumber(text: string) {
  return /(?:^|\D)(?:\d[ -]?){12,18}\d(?:\D|$)/.test(text);
}

export function containsAssistantSecret(text: string) {
  return (
    containsCardNumber(text) ||
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text) ||
    /\b(?:bearer\s+[\w.-]{12,}|(?:gsk_|sk-|sb_secret_|ghp_)[\w-]{12,}|eyJ[\w-]+\.[\w-]+\.[\w-]+|(?:password|passcode|api[ _-]?key|cvv|cvc)\s*(?::|=|\bis\b)\s*\S+)/i.test(
      text,
    )
  );
}
