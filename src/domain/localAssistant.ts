import type { AssistantAction, AssistantDraft } from "./assistantProtocol";
import { currencies, dateSchema } from "./models";

const currencyCodes = currencies.join("|");
const currencyPattern = new RegExp("\\b(" + currencyCodes + "|euros?)\\b", "i");
const pricePattern = new RegExp(
  "(?:€\\s*(\\d{1,10}(?:[.,]\\d{1,3})?)|\\b(\\d{1,10}(?:[.,]\\d{1,3})?)\\s*(" +
    currencyCodes +
    "|euros?)\\b)",
  "i",
);
const monthNames = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const datePattern =
  "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2} (?:" + monthNames.join("|") + ") \\d{4})";

function dateAfter(text: string, prefix: string) {
  const raw = new RegExp(prefix + "\\s+" + datePattern, "i").exec(text)?.[1];
  if (!raw) return null;
  const [day, month, year] = raw.toLowerCase().split(" ");
  const formatted =
    month && day && year
      ? year +
        "-" +
        String(monthNames.indexOf(month) + 1).padStart(2, "0") +
        "-" +
        day.padStart(2, "0")
      : raw;
  return dateSchema.safeParse(formatted).data ?? null;
}

function currencyOf(text: string) {
  const raw = currencyPattern.exec(text)?.[1]?.toUpperCase();
  return (
    currencies.find((currency) => currency === raw) ??
    (raw?.startsWith("EURO") || text.includes("€") ? "EUR" : null)
  );
}

function nameOf(value: string | undefined) {
  return (
    value
      ?.trim()
      .replace(/[?.!]+$/, "")
      .trim()
      .slice(0, 80) || null
  );
}

export function interpretLocalAssistant(
  input: string,
  continuingDraft: boolean,
): AssistantAction {
  const text = input.trim();
  const add =
    /^(?:(?:i (?:want|would like) to|help me) )?add (?:a |an )?(.+?)(?=\s+(?:subscription\b|started\b|for\b|at\b|weekly\b|monthly\b|quarterly\b|yearly\b|with\b)|[,.!?]|$)/i.exec(
      text,
    );
  const price = pricePattern.exec(text);
  const start = dateAfter(text, "\\b(?:start(?:ed|s)? on)");
  const renewal = dateAfter(text, "\\b(?:next renewal (?:is )?on|renews on)");
  const method = /^leave it unassigned[.!]?$/i.test(text)
    ? ""
    : nameOf(
        /\b(?:paid with|linked it to|using) (?:my )?([^,.!?]+)/i.exec(
          text,
        )?.[1],
      );
  const interval = /\b(weekly|monthly|quarterly|yearly)\b/i
    .exec(text)?.[1]
    ?.toLowerCase();
  if (
    add ||
    (continuingDraft &&
      (price ||
        start ||
        renewal ||
        interval ||
        method !== null ||
        currencyOf(text)))
  ) {
    const name = nameOf(add?.[1]);
    if (name?.toLowerCase() === "subscription")
      return { kind: "open_add_subscription" };
    const intervals = ["weekly", "monthly", "quarterly", "yearly"] as const;
    return {
      kind: "add_subscription",
      name,
      amount: (price?.[1] ?? price?.[2])?.replace(",", ".") ?? null,
      currency: currencyOf(text),
      interval:
        intervals.find((value) => value === interval) ??
        (/\bevery month\b/i.test(text) ? "monthly" : null),
      start,
      renewal,
      method,
    } satisfies AssistantDraft;
  }
  if (
    /^(?:what (?:renews next|is coming up|trials end soon)|show upcoming renewals)[?.!]*$/i.test(
      text,
    )
  )
    return { kind: "upcoming" };
  if (/^(?:list|show)(?: my)? (?:subscriptions|plans)[?.!]*$/i.test(text))
    return { kind: "list_subscriptions" };
  if (
    /^(?:list|show)(?: my)? (?:cards(?: and wallets)?|wallets|payment methods)[?.!]*$/i.test(
      text,
    )
  )
    return { kind: "list_billing" };
  if (
    /^(?:manage|open) (?:my )?(?:cards|wallets|cards and wallets)[?.!]*$/i.test(
      text,
    )
  )
    return { kind: "manage_billing" };
  if (/^(?:open|manage) (?:my )?reminders?[?.!]*$/i.test(text))
    return { kind: "open_reminders", subscription: null };
  const link = /^(?:link|assign) (.+?) to (?:my )?(.+)$/i.exec(text);
  const subscription = nameOf(link?.[1]);
  const linkedMethod = nameOf(link?.[2]);
  if (subscription && linkedMethod)
    return { kind: "assign_billing", subscription, method: linkedMethod };
  const lookup =
    /^(?:when does (.+?) renew|how much does (.+?) cost|show (.+))\??$/i.exec(
      text,
    );
  const name = nameOf(lookup?.[1] ?? lookup?.[2] ?? lookup?.[3]);
  if (name) return { kind: "subscription", name };
  const appearance =
    /^(?:switch|change|set)(?: my)?(?: theme)? to (light|dark|system)(?: mode)?[?.!]*$/i
      .exec(text)?.[1]
      ?.toLowerCase();
  if (
    appearance === "light" ||
    appearance === "dark" ||
    appearance === "system"
  )
    return { kind: "preferences", appearance, accent: null, currency: null };
  if (/^(?:switch|change|set) (?:my )?(?:display )?currency to /i.test(text)) {
    const currency = currencyOf(text);
    if (currency)
      return { kind: "preferences", appearance: null, accent: null, currency };
  }
  const reminder =
    /^remind me ((?:[0137] days?(?: and |, ))*[0137] days?) (?:before(?: renewal)?|ahead)(?: at ([01]?\d|2[0-3])(?::00)?(?: ?(am|pm))?)?[?.!]*$/i.exec(
      text,
    );
  if (reminder) {
    const offsets = new Set(reminder[1]?.match(/[0137]/g));
    const days = ([0, 1, 3, 7] as const).filter((day) =>
      offsets.has(String(day)),
    );
    const hour = reminder[2] === undefined ? null : Number(reminder[2]);
    const period = reminder[3]?.toLowerCase();
    if (period && (hour === null || hour < 1 || hour > 12))
      return { kind: "open_reminders", subscription: null };
    return {
      kind: "reminders",
      days,
      hour:
        period && hour !== null
          ? (hour % 12) + (period === "pm" ? 12 : 0)
          : hour,
      quietStart: null,
      quietEnd: null,
    };
  }
  return { kind: "help" };
}
