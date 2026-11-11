import type {
  AssistantAction,
  AssistantBillingChange,
  AssistantDraft,
  AssistantSubscriptionEdit,
} from "./assistantProtocol";
import { currencies, dateSchema, type AccentTheme } from "./models";
import { cardBrands, walletProviders } from "./payments";
import { Temporal } from "@js-temporal/polyfill";

type LocalContext = {
  today?: string;
  subscription?: string;
  pending?: AssistantAction;
};

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
const monthLabels = [
  ...new Set(monthNames.flatMap((month) => [month, month.slice(0, 3)])),
];
const datePattern =
  "(today|tomorrow|yesterday|\\d{4}-\\d{2}-\\d{2}|\\d{1,2} (?:" +
  monthLabels.join("|") +
  ")(?: \\d{4})?)(?=\\b|$)";

function dateAfter(text: string, prefix: string, today?: string) {
  const raw = new RegExp(prefix + "\\s+" + datePattern, "i").exec(text)?.[1];
  if (!raw) return null;
  const relativeDates: Record<string, number> = {
    today: 0,
    tomorrow: 1,
    yesterday: -1,
  };
  const relative = relativeDates[raw.toLowerCase()];
  if (relative !== undefined)
    return today
      ? Temporal.PlainDate.from(today).add({ days: relative }).toString()
      : null;
  const [day, month, suppliedYear] = raw.toLowerCase().split(" ");
  const year = suppliedYear ?? today?.slice(0, 4);
  const formatted =
    month && day && year
      ? year +
        "-" +
        String(
          monthNames.findIndex((value) => value.startsWith(month)) + 1,
        ).padStart(2, "0") +
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

function scopedName(value: string | undefined) {
  const name = nameOf(value)
    ?.replace(/^(?:(?:the|my|a|an) )/i, "")
    .replace(/(?:['’]s| (?:subscription|plan))$/i, "");
  return name && !/^(?:subscription|plan|it)$/i.test(name) ? name : null;
}

function readAnalytics(text: string): AssistantAction | null {
  if (
    /^(?:add|edit|update|change|set|delete|remove|rename|link|assign)\b/i.test(
      text,
    )
  )
    return null;
  const range = /\b(next|this) (month|year)\b/i.exec(text);
  const metric =
    /\b(?:average|recurring)\b/i.test(text) &&
    /\b(?:cost|spend|spending|average|total)\b/i.test(text)
      ? "recurring"
      : /\b(?:by category|categories)\b/i.test(text) &&
          /\b(?:spend|spending|cost|breakdown)\b/i.test(text)
        ? "by_category"
        : /\b(?:most expensive|highest cost|biggest expense)\b/i.test(text)
          ? "most_expensive"
          : /\b(?:trial|trials)\b/i.test(text) && range
            ? "trials"
            : /\b(?:renew|renews|renewal|renewals)\b/i.test(text) && range
              ? "renewals"
              : /\b(?:spend|spending|pay|total|cost)\b/i.test(text) &&
                  (range || /\bhow much am i spending\b/i.test(text))
                ? "spending"
                : null;
  if (!metric) return null;
  const next = range?.[1]?.toLowerCase() === "next";
  const annual =
    range?.[2]?.toLowerCase() === "year" ||
    (!range && metric === "recurring" && /\b(?:yearly|annual)\b/i.test(text));
  return {
    kind: "analytics",
    metric,
    from: null,
    through: null,
    subscription: scopedName(
      /\b(?:on|for) (.+?) (?:next|this) (?:month|year)\b/i.exec(text)?.[1],
    ),
    period: annual
      ? next
        ? "next_year"
        : "this_year"
      : next
        ? "next_month"
        : "this_month",
  };
}

function readBillingChange(
  text: string,
  pending?: AssistantAction,
): AssistantBillingChange | null {
  const add = /^add (.+)$/i.exec(text);
  const rename = /^rename (.+?) to (.+)$/i.exec(text);
  const edit = /^(?:edit|update|change) (.+?)(?: to (.+))?$/i.exec(text);
  const remove = /^(?:remove|delete) (.+)$/i.exec(text);
  const target = add?.[1] ?? rename?.[1] ?? edit?.[1] ?? remove?.[1];
  const type = /\bwallet\b/i.test(target ?? "")
    ? "wallet"
    : /\bcard\b/i.test(target ?? "")
      ? "card"
      : null;
  const cardBrand = cardBrands.find((item) =>
    text.toLowerCase().includes(item.toLowerCase()),
  );
  const walletBrand = walletProviders.find((item) =>
    text.toLowerCase().includes(item.toLowerCase()),
  );
  const last4 =
    /(?:\b(?:last (?:four|4)(?: digits)?(?: are| is)?|ending (?:in|with)|ends in)\s*|^)(\d{4})\b/i.exec(
      text,
    )?.[1] ?? null;
  const called = nameOf(
    /\b(?:named|called|call it|rename to|nickname is) (.+)$/i.exec(text)?.[1],
  );
  const brand =
    type === "card"
      ? cardBrand
      : type === "wallet"
        ? walletBrand
        : (cardBrand ?? walletBrand);
  if (target && type && !/\bsubscription\b/i.test(target)) {
    const method = nameOf(
      target
        .replace(/^(?:(?:my|the|a|an) )/i, "")
        .replace(/\s+(?:card|wallet)$/i, ""),
    );
    const plainAddName = nameOf(
      /^(?:(?:my|the|a|an) )?(.+?)\s+(?:card|wallet)(?:\s|$)/i.exec(
        target,
      )?.[1],
    );
    return {
      kind: "payment_method",
      operation: add ? "add" : remove ? "delete" : "edit",
      method: add
        ? null
        : method && !/^(?:card|wallet)$/i.test(method)
          ? method
          : null,
      type,
      name: add
        ? (called ?? (brand ? null : plainAddName))
        : (nameOf(rename?.[2] ?? edit?.[2]) ?? called),
      brand: (add ? brand : undefined) ?? null,
      last4,
    };
  }
  if (
    pending?.kind === "payment_method" &&
    (last4 || called || brand || /^(?:a )?(?:card|wallet)[.!]?$/i.test(text))
  )
    return {
      kind: "payment_method",
      operation: pending.operation,
      method: null,
      type: /wallet/i.test(text)
        ? "wallet"
        : /card/i.test(text)
          ? "card"
          : null,
      name: called,
      brand: brand ?? null,
      last4,
    };
  if (
    pending?.kind === "payment_method" &&
    /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,59}$/u.test(text)
  ) {
    if (pending.operation !== "add" && !pending.method)
      return { ...pending, method: nameOf(text) };
    if (
      pending.operation === "add" &&
      pending.type &&
      !pending.name &&
      !pending.brand
    )
      return { ...pending, name: nameOf(text) };
  }
  return null;
}

function changeDetails(
  text: string,
  context: LocalContext,
): AssistantSubscriptionEdit["changes"] {
  const result: AssistantSubscriptionEdit["changes"] = [];
  // Notes can mention prices or dates without requesting changes to those fields.
  const note = /\bnotes? (?:to|is) (.+)$/i.exec(text);
  if (note) {
    result.push({ field: "notes", value: note[1] ?? "" });
    text = text.slice(0, note.index);
  } else if (/\bclear (?:the )?notes?\b/i.test(text)) {
    result.push({ field: "notes", value: "" });
  }
  const price = pricePattern.exec(text);
  const amount = (
    price?.[1] ??
    price?.[2] ??
    /\b(?:price|cost|amount)(?: is| to)?\s+(\d{1,9}(?:[.,]\d{1,3})?)/i.exec(
      text,
    )?.[1]
  )?.replace(",", ".");
  if (amount) result.push({ field: "price", value: amount });
  const currency = currencyOf(text);
  if (currency) result.push({ field: "currency", value: currency });
  const start = dateAfter(
    text,
    "\\b(?:start(?:ed|s)?(?: date)?(?: is| to)?(?: on| from)?)",
    context.today,
  );
  const renewal = dateAfter(
    text,
    "\\b(?:next renewal(?: date)?(?: is| to)?(?: on)?|renews on)",
    context.today,
  );
  if (start) result.push({ field: "startDate", value: start });
  if (renewal) result.push({ field: "nextRenewal", value: renewal });
  const interval = /\b(weekly|monthly|quarterly|yearly)\b/i.exec(text)?.[1];
  if (interval)
    result.push({ field: "interval", value: interval.toLowerCase() });
  const custom = /\bevery ([1-9]\d{0,2}) (day|week|month|year)s?\b/i.exec(text);
  if (custom?.[1] && custom[2] && !interval) {
    result.push(
      { field: "interval", value: "custom" },
      { field: "intervalCount", value: custom[1] },
      { field: "customUnit", value: custom[2].toLowerCase() },
    );
  }
  const trial = dateAfter(
    text,
    "\\b(?:trial end(?:s| date)?(?: is| to)?(?: on)?)",
    context.today,
  );
  if (trial)
    result.push(
      { field: "status", value: "trial" },
      { field: "trialEnd", value: trial },
    );
  const category = nameOf(/\bcategory (?:to|is) (.+)$/i.exec(text)?.[1]);
  if (category) result.push({ field: "category", value: category });
  return result;
}

export function interpretLocalAssistant(
  input: string,
  continuingDraft: boolean,
  context: LocalContext = {},
): AssistantAction {
  const text = input
    .trim()
    .replace(
      /^(?:please[ ,]+|(?:can|could|would) you |i (?:want|would like) (?:you )?to )/i,
      "",
    );
  const analytics = readAnalytics(text);
  if (analytics) return analytics;
  const unlink =
    /^(?:(?:unlink|unassign|disassign) (?:.+? from )?|remove (?:the )?payment method from )(.+)$/i.exec(
      text,
    );
  const unlinkName = scopedName(unlink?.[1]);
  if (unlinkName)
    return { kind: "assign_billing", subscription: unlinkName, method: null };
  const billing = readBillingChange(text, context.pending);
  if (billing) return billing;
  const planReminders =
    /^(?:(?:turn )?(on|off)|(enable|disable)) reminders for (.+)$/i.exec(text);
  if (planReminders)
    return {
      kind: "edit_subscription",
      subscription: scopedName(planReminders[3]),
      changes: [
        {
          field: "remindersEnabled",
          value: String(
            /^(on|enable)$/i.test(planReminders[1] ?? planReminders[2] ?? ""),
          ),
        },
      ],
    };
  const referent = (name: string | undefined) =>
    /^(?:it|this|that)(?: subscription| plan)?[.!]?$/i.test(name?.trim() ?? "")
      ? context.pending?.kind === "add_subscription"
        ? context.pending.name
        : context.pending?.kind === "edit_subscription"
          ? context.pending.subscription
          : (context.subscription ?? null)
      : scopedName(name);
  const deletion = /^(?:delete|remove)(?: (.+))?[?.!]*$/i.exec(text);
  if (deletion)
    return {
      kind: "delete_subscription",
      subscription: referent(deletion[1]),
    };
  const edit =
    /^(?:edit|update|change|set) (.+?)(?: (?:to|from) (.+))?[?.!]*$/i.exec(
      text,
    );
  const priceEdit =
    /^(?:edit|update|change|set) (?:the )?(?:price|cost|amount) (?:of|for) (.+?) to (.+)$/i.exec(
      text,
    );
  const rename = /^rename (.+?) to (.+)$/i.exec(text);
  const status = /^(pause|resume|mark canceled) (.+)$/i.exec(text);
  if (rename && scopedName(rename[1]))
    return {
      kind: "edit_subscription",
      subscription: scopedName(rename[1]),
      changes: [{ field: "name", value: nameOf(rename[2]) ?? "" }],
    };
  if (status)
    return {
      kind: "edit_subscription",
      subscription: scopedName(status[2]),
      changes: [
        {
          field: "status",
          value:
            status[1]?.toLowerCase() === "pause"
              ? "paused"
              : status[1]?.toLowerCase() === "resume"
                ? "active"
                : "canceled",
        },
      ],
    };
  const editName = referent(
    priceEdit?.[1] ??
      edit?.[1]?.replace(
        /(?:['’]s)? (?:price|cost|amount|category|billing frequency|next renewal(?: date)?|start date|trial end(?: date)?|notes)$/i,
        "",
      ),
  );
  const editText = priceEdit
    ? "price " + priceEdit[2]
    : edit?.[2]
      ? (edit[1] ?? "") + " to " + edit[2]
      : "";
  const isSetting =
    /^(?:my )?(?:(?:display )?currency|theme|appearance|accent(?: color)?|colou?r|reminders?)$/i.test(
      editName ?? "",
    );
  if (edit && editName && !isSetting) {
    const changes = changeDetails(editText, context);
    if (
      !changes.length &&
      edit?.[2] &&
      /^\d{1,9}(?:[.,]\d{1,3})?$/.test(edit[2])
    )
      changes.push({ field: "price", value: edit[2].replace(",", ".") });
    if (changes.length || (/^(?:edit|update)\b/i.test(text) && !edit?.[2]))
      return { kind: "edit_subscription", subscription: editName, changes };
  }
  const add =
    /^(?:(?:i (?:want|would like) to|help me) )?add (?:a |an )?(.+?)(?=\s+(?:subscription\b|started\b|for\b|at\b|weekly\b|monthly\b|quarterly\b|yearly\b|with\b)|[,.!?]|$)/i.exec(
      text,
    );
  const price = pricePattern.exec(text);
  const start =
    dateAfter(
      text,
      "\\b(?:start(?:ed|s)?(?: date)?(?: is| to)?(?: on| from)?)",
      context.today,
    ) ??
    (continuingDraft && /^(?:use )?today[.!]?$/i.test(text)
      ? (context.today ?? null)
      : null);
  const renewal = dateAfter(
    text,
    "\\b(?:next renewal(?: date)?(?: is| to)?(?: on)?|renews on)",
    context.today,
  );
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
    const details = changeDetails(text, context).filter(
      ({ field }) =>
        !["price", "currency", "startDate", "nextRenewal"].includes(field),
    );
    return {
      kind: "add_subscription",
      name,
      amount: (price?.[1] ?? price?.[2])?.replace(",", ".") ?? null,
      currency: currencyOf(text),
      interval:
        intervals.find((value) => value === interval) ??
        (/\b(?:every|per|a) month\b/i.test(text) ? "monthly" : null),
      start,
      renewal,
      method,
      ...(details.length ? { details } : {}),
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
  const accent =
    /^(?:switch|change|set) (?:my )?(?:accent(?: colou?r)?|colou?r) to (green|blue|red|violet|orange|yellow|pink|mono|black and white)[?.!]*$/i
      .exec(text)?.[1]
      ?.toLowerCase();
  if (accent)
    return {
      kind: "preferences",
      appearance: null,
      accent: (accent === "black and white" ? "mono" : accent) as AccentTheme,
      currency: null,
    };
  const delivery =
    /^(?:(turn) (on|off) |(enable|disable) )(email|trial) reminders[?.!]*$/i.exec(
      text,
    );
  if (delivery)
    return {
      kind: "reminder_delivery",
      setting:
        delivery[4]?.toLowerCase() === "email"
          ? "emailEnabled"
          : "trialReminders",
      enabled: /^(on|enable)$/i.test(delivery[2] ?? delivery[3] ?? ""),
    };
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
  const pending = context.pending;
  const knownSubscription =
    pending?.kind === "edit_subscription"
      ? (pending.subscription ?? context.subscription)
      : pending?.kind === "add_subscription"
        ? (pending.name ?? undefined)
        : context.subscription;
  if (
    knownSubscription ||
    pending?.kind === "edit_subscription" ||
    pending?.kind === "add_subscription"
  ) {
    const question =
      /^(?:what|how|when|why|does|is|tell|show|list)\b/i.test(text) ||
      text.endsWith("?");
    const changes = question ? [] : changeDetails(text, context);
    if (changes.length)
      return {
        kind: "edit_subscription",
        subscription: knownSubscription ?? null,
        changes,
      };
  }
  if (
    pending?.kind === "edit_subscription" &&
    !pending.subscription &&
    /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,79}$/u.test(text)
  )
    return { ...pending, subscription: scopedName(text) };
  if (
    pending?.kind === "delete_subscription" &&
    !pending.subscription &&
    !/[?]/.test(text)
  )
    return { kind: "delete_subscription", subscription: scopedName(text) };
  return { kind: "help" };
}
