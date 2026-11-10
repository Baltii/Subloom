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
});

export const assistantResponseSchema = z.strictObject({
  action: z.discriminatedUnion("kind", [
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
        .array(
          z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]),
        )
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
  ]),
});

export type AssistantAction = z.infer<typeof assistantResponseSchema>["action"];
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantDraft = Extract<
  AssistantAction,
  { kind: "add_subscription" }
>;

export function mergeAssistantDraft(
  action: AssistantAction,
  previous?: AssistantDraft,
): AssistantAction {
  if (!previous || action.kind !== "add_subscription") return action;
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
  };
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
