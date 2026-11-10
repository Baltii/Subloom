import { randomUUID } from "expo-crypto";
import type { Href } from "expo-router";
import type { AssistantAction } from "../domain/assistantProtocol";
import {
  billingMethodLabel,
  billingReference,
  subscriptionBillingLabel,
  unassignedBillingMethod,
} from "../domain/billingMethods";
import { quickAddDates } from "../domain/calendarEvents";
import { catalog } from "../domain/catalog";
import {
  dateSchema,
  type Preferences,
  type Subscription,
} from "../domain/models";
import { formatMoney, parseMoney } from "../domain/money";
import {
  emptyPaymentProfile,
  paymentProfileSchema,
  type PaymentProfile,
  type PaymentSource,
} from "../domain/payments";
import {
  advanceRenewal,
  dateLabel,
  intervalLabel,
  nextEvent,
  today,
  upcoming,
} from "../domain/renewal";
import { saveSubscription, updatePreferences, useApp } from "../store/app";
import { readSetting } from "./featureSettings";

type Row = { label: string; value: string };
export type AssistantReply = {
  text: string;
  title?: string;
  rows?: Row[];
  awaitingDetails?: boolean;
  next?:
    | { label: string; route: Href }
    | { label: string; run: () => Promise<string> };
};

function assistantWorkspace(identity: string) {
  const { data, hydrated, identity: current } = useApp.getState();
  if (!hydrated || current !== identity || data.demo)
    throw new Error("Your workspace changed. Open chat again to continue.");
  return data;
}
function billingMatches(profile: PaymentProfile, label: string) {
  const normalize = (value: string) => value.trim().toLowerCase();
  const sources = profile.sources.filter((item) => item.kind !== "bank");
  const exact = (text: string) =>
    sources.filter((item) =>
      [item.name, billingMethodLabel(item), item.walletProvider].some(
        (name) => name && normalize(name) === text,
      ),
    );
  const query = normalize(label);
  const matches = exact(query);
  return matches.length
    ? matches
    : exact(query.replace(/\s+(?:card|wallet)$/, ""));
}
function localDate(date: string) {
  return dateLabel(date, { month: "short", day: "numeric", year: "numeric" });
}
function matchName<T>(
  items: T[],
  name: string,
  names: (item: T) => string[],
): T[] {
  const normalize = (value: string) => value.trim().toLowerCase();
  const search = normalize(name);
  if (!search) return [];
  const exact = items.filter((item) =>
    names(item).some((value) => normalize(value) === search),
  );
  return exact.length
    ? exact
    : items.filter((item) =>
        names(item).some((value) => normalize(value).includes(search)),
      );
}

const reminderSettings = {
  pathname: "/settings",
  params: { section: "Reminders" },
} as const;
function ask(text: string, rows?: Row[]): AssistantReply {
  return {
    text,
    title: rows?.length ? "Matching records" : undefined,
    rows,
    awaitingDetails: true,
  };
}
function preferencesReply(
  identity: string,
  text: string,
  title: string,
  rows: Row[],
  changes: Partial<Preferences>,
): AssistantReply {
  if (!rows.length) return ask("What would you like to change?");
  return {
    text,
    title,
    rows,
    next: {
      label: "Apply changes",
      run: async () => {
        assistantWorkspace(identity);
        await updatePreferences(changes, identity);
        return "Your settings are saved.";
      },
    },
  };
}

async function billingMethods(identity: string) {
  assistantWorkspace(identity);
  const { value } = await readSetting(
    identity,
    "payment_sources",
    paymentProfileSchema,
    emptyPaymentProfile,
  );
  assistantWorkspace(identity);
  return value;
}

async function verifiedBillingReference(
  identity: string,
  source: PaymentSource,
) {
  const latest = await billingMethods(identity);
  if (
    !latest.sources.some(
      (item) =>
        item.id === source.id &&
        billingMethodLabel(item) === billingMethodLabel(source),
    )
  )
    throw new Error(
      "That payment label changed. Ask again to review the update.",
    );
  return billingReference(source.id);
}

export async function resolveAssistantAction(
  action: AssistantAction,
  identity: string,
): Promise<AssistantReply> {
  const data = assistantWorkspace(identity);
  const { preferences } = data;
  const subscriptions = data.subscriptions.filter(
    (item) => item.userId === identity,
  );
  const reference = today(preferences.timezone);
  switch (action.kind) {
    case "help":
      return {
        text: "I can look up subscriptions, check upcoming renewals, draft a new plan, and help with appearance, currency, reminders, and saved payment labels.",
      };
    case "clarify":
      return ask(
        "Tell me one thing you’d like to do and include the saved name if it’s about a subscription or wallet.",
      );
    case "list_subscriptions":
      return {
        text: subscriptions.length
          ? subscriptions.length > 10
            ? "Here are the first ten subscriptions in this workspace."
            : "Here are your saved subscriptions."
          : "There are no saved subscriptions in this workspace.",
        title: "Subscriptions",
        rows: subscriptions.slice(0, 10).map((item) => ({
          label: item.name,
          value:
            formatMoney(item.amountMinor, item.currency) +
            " · " +
            intervalLabel(item),
        })),
      };
    case "upcoming": {
      const events = upcoming(subscriptions, preferences.timezone).filter(
        (event) => event.type !== "paid_through",
      );
      return events.length
        ? {
            text:
              events.length > 5
                ? "Here are the next five dates in your workspace."
                : "Here’s what’s coming up.",
            title: "Upcoming renewals & trials",
            rows: events.slice(0, 5).map((event) => ({
              label: event.subscription.name,
              value:
                localDate(event.date) +
                (event.type === "trial" ? " · Trial ends" : ""),
            })),
            next: { label: "Open calendar", route: "/calendar" },
          }
        : {
            text: "There are no upcoming renewals or trial endings in this workspace.",
          };
    }
    case "open_reminders":
    case "subscription":
    case "assign_billing": {
      if (action.kind === "open_reminders" && action.subscription === null)
        return {
          text: "You can manage device notifications and reminder delivery in Settings.",
          next: { label: "Open reminder settings", route: reminderSettings },
        };
      const name =
        action.kind === "subscription"
          ? action.name
          : (action.subscription ?? "");
      const matches = matchName(subscriptions, name, (item) => [item.name]);
      const [subscription] = matches;
      if (!subscription)
        return ask(
          "I couldn’t find that subscription. What name is it saved under?",
        );
      if (matches.length > 1)
        return ask(
          "I found more than one match. Open your subscriptions to select the exact plan, or tell me its full saved name.",
          matches.slice(0, 5).map((item) => ({
            label: item.name,
            value: formatMoney(item.amountMinor, item.currency),
          })),
        );
      if (action.kind === "open_reminders") {
        return {
          text:
            "You can change reminders for " +
            subscription.name +
            " in its details.",
          next: {
            label: "Open subscription",
            route: {
              pathname: "/subscription/[id]",
              params: { id: subscription.id },
            },
          },
        };
      }
      if (action.kind === "subscription") {
        const event = nextEvent(subscription, reference);
        const rows = [
          {
            label: "Price",
            value:
              formatMoney(subscription.amountMinor, subscription.currency) +
              (subscription.interval !== "custom" &&
              subscription.intervalCount === 1
                ? " / "
                : " · ") +
              intervalLabel(subscription),
          },
          {
            label: "Status",
            value:
              subscription.status.charAt(0).toUpperCase() +
              subscription.status.slice(1),
          },
          {
            label:
              event?.type === "trial"
                ? "Trial ends"
                : event?.type === "paid_through"
                  ? "Paid through"
                  : "Next renewal",
            value: event ? localDate(event.date) : "None scheduled",
          },
        ];
        return {
          text: "Here’s what’s saved in Subloom.",
          title: subscription.name,
          rows,
          next: {
            label: "Open subscription",
            route: {
              pathname: "/subscription/[id]",
              params: { id: subscription.id },
            },
          },
        };
      }
      const profile = await billingMethods(identity);
      const sources =
        action.method === null ? [] : billingMatches(profile, action.method);
      const [source] = sources;
      if (action.method !== null && !source)
        return ask(
          "I couldn’t find that saved card or wallet. What label do you use for it?",
        );
      if (sources.length > 1)
        return ask(
          "Several saved methods match. Which exact label should I use?",
          sources.slice(0, 5).map((item) => ({
            label: billingMethodLabel(item),
            value: item.kind,
          })),
        );
      return {
        text: "Review the payment label for this subscription.",
        title: subscription.name,
        rows: [
          {
            label: "Current",
            value: subscriptionBillingLabel(subscription, profile),
          },
          {
            label: "Change to",
            value: source ? billingMethodLabel(source) : "Not assigned",
          },
        ],
        next: {
          label: "Save payment label",
          run: async () => {
            const paymentMethod = source
              ? await verifiedBillingReference(identity, source)
              : unassignedBillingMethod;
            const current = assistantWorkspace(identity).subscriptions.find(
              (item) => item.userId === identity && item.id === subscription.id,
            );
            if (!current || current.version !== subscription.version)
              throw new Error(
                "That subscription changed. Ask again to review the update.",
              );
            await saveSubscription(
              {
                ...current,
                paymentMethod,
              },
              undefined,
              current.version,
              identity,
            );
            return "The payment label is saved in Subloom.";
          },
        },
      };
    }
    case "open_add_subscription":
      return {
        text: "Use the subscription form to review all the details, including trials and custom schedules.",
        next: { label: "Open subscription form", route: "/subscription/new" },
      };
    case "add_subscription": {
      const { name, amount, currency, interval, start, method } = action;
      const startDate = dateSchema.safeParse(start).data;
      const explicitRenewal = dateSchema.safeParse(action.renewal).data;
      if (start && !startDate)
        return ask("What is the valid start date for this plan?");
      const cadence = interval && {
        interval,
        intervalCount: 1,
        customUnit: "day" as const,
        anchorDay: Number(
          (explicitRenewal ?? startDate ?? reference).slice(-2),
        ),
      };
      const renewal =
        explicitRenewal ??
        (!action.renewal && startDate && cadence
          ? nextEvent(
              {
                ...cadence,
                status: "active",
                nextRenewal: advanceRenewal(startDate, cadence),
                trialEnd: null,
                paidThrough: null,
              },
              reference,
            )?.date
          : undefined);
      const missing = [
        !name?.trim() && "subscription name",
        amount === null && "price",
        !currency && "currency code (such as USD, EUR or TND)",
        !interval && "billing frequency",
        !renewal && "next renewal or start date",
      ].filter(Boolean);
      if (
        !name?.trim() ||
        amount === null ||
        !currency ||
        !cadence ||
        !renewal ||
        missing.length
      )
        return ask(
          "To finish this draft, I need the " + missing.join(", ") + ".",
        );
      if (startDate && renewal < startDate)
        return ask(
          "Which date is the next renewal? It needs to be on or after the start date.",
        );
      let amountMinor: number;
      try {
        amountMinor = parseMoney(amount, currency);
      } catch {
        return ask(
          "What is the price in " +
            currency +
            "? Use the amount shown on your plan.",
        );
      }
      if (amountMinor > 1_000_000_000)
        return ask(
          "That amount is above Subloom’s supported range. What is the price on your plan?",
        );
      const service = catalog.find(
        (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
      );
      const dates = {
        ...quickAddDates(renewal, reference),
        ...(startDate ? { startDate } : {}),
      };
      const sources = method
        ? billingMatches(await billingMethods(identity), method)
        : [];
      const [source] = sources;
      if (method && !source)
        return ask(
          "I couldn’t find that saved card or wallet. Tell me its saved label or say to leave it unassigned.",
        );
      if (sources.length > 1)
        return ask(
          "Several payment methods match. Tell me the exact saved label.",
          sources.slice(0, 5).map((item) => ({
            label: billingMethodLabel(item),
            value: item.kind,
          })),
        );
      const id = randomUUID();
      return {
        text: "Check these details before adding the subscription.",
        title: name.trim(),
        rows: [
          {
            label: "Price",
            value:
              formatMoney(amountMinor, currency) + " · " + cadence.interval,
          },
          { label: "Start date", value: localDate(dates.startDate) },
          { label: "Next renewal", value: localDate(renewal) },
          {
            label: "Payment method",
            value: source ? billingMethodLabel(source) : "Not assigned",
          },
          { label: "Category", value: service?.category || "Other" },
        ],
        next: {
          label: "Add subscription",
          run: async () => {
            const paymentMethod = source
              ? await verifiedBillingReference(identity, source)
              : unassignedBillingMethod;
            const current = assistantWorkspace(identity);
            if (current.subscriptions.some((item) => item.id === id))
              return name.trim() + " was added.";
            if (
              current.subscriptions.some(
                (item) =>
                  item.userId === identity &&
                  item.name.toLowerCase() === name.trim().toLowerCase() &&
                  item.amountMinor === amountMinor &&
                  item.currency === currency &&
                  item.interval === cadence.interval &&
                  item.nextRenewal === renewal,
              )
            )
              throw new Error(
                "A subscription with those details is already saved.",
              );
            const now = new Date().toISOString();
            const draft: Subscription = {
              id,
              userId: identity,
              serviceId: service?.id || null,
              name: name.trim(),
              category: service?.category || "Other",
              amountMinor,
              currency,
              ...cadence,
              ...dates,
              trialEnd: null,
              canceledAt: null,
              paidThrough: null,
              status: "active",
              paymentMethod,
              notes: "",
              source: "manual",
              reminders: null,
              createdAt: now,
              updatedAt: now,
              version: 0,
            };
            await saveSubscription(draft, undefined, undefined, identity);
            return name.trim() + " was added.";
          },
        },
      };
    }
    case "preferences": {
      const rows: Row[] = [],
        changes: Partial<Preferences> = {};
      if (action.appearance !== null) {
        changes.appearance = action.appearance;
        rows.push({ label: "Appearance", value: action.appearance });
      }
      if (action.accent !== null) {
        changes.accentTheme = action.accent;
        rows.push({
          label: "Accent",
          value: action.accent === "mono" ? "Black & white" : action.accent,
        });
      }
      if (action.currency !== null) {
        changes.currency = action.currency;
        if (action.currency !== preferences.currency)
          changes.highRenewalThresholdMinor = null;
        rows.push({ label: "Display currency", value: action.currency });
        if (
          changes.highRenewalThresholdMinor === null &&
          preferences.highRenewalThresholdMinor !== null
        )
          rows.push({
            label: "High renewal threshold",
            value: "Reset for the new currency",
          });
      }
      return preferencesReply(
        identity,
        "Review your display changes.",
        "Appearance & region",
        rows,
        changes,
      );
    }
    case "reminders": {
      const rows: Row[] = [],
        changes: Partial<Preferences> = {};
      if (action.days !== null) {
        const days = [...new Set(action.days)].sort((a, b) => b - a);
        changes.reminderDays = days;
        rows.push({
          label: "Before renewal",
          value:
            days
              .map((day) =>
                day === 0 ? "On the day" : day === 1 ? "1 day" : day + " days",
              )
              .join(", ") || "No advance reminders",
        });
      }
      const time = (hour: number) => String(hour).padStart(2, "0") + ":00";
      if (action.hour !== null) {
        changes.reminderHour = action.hour;
        rows.push({
          label: "Reminder time",
          value: time(action.hour) + " · " + preferences.timezone,
        });
      }
      if (action.quietStart !== null || action.quietEnd !== null) {
        changes.quietStart = action.quietStart ?? preferences.quietStart;
        changes.quietEnd = action.quietEnd ?? preferences.quietEnd;
        rows.push({
          label: "Quiet hours",
          value:
            changes.quietStart === changes.quietEnd
              ? "Off"
              : time(changes.quietStart) + " to " + time(changes.quietEnd),
        });
      }
      return preferencesReply(
        identity,
        "Review your reminder changes.",
        "Reminder preferences",
        rows,
        changes,
      );
    }
    case "reminder_delivery":
      if (identity === "guest" && action.setting === "emailEnabled")
        return {
          text: "Email reminders use a connected account. You can manage reminders on this device in Settings.",
          next: { label: "Open reminder settings", route: reminderSettings },
        };
      return preferencesReply(
        identity,
        "Review your reminder change.",
        "Reminder preferences",
        [
          {
            label:
              action.setting === "trialReminders"
                ? "Trial reminders"
                : "Email reminders",
            value: action.enabled ? "On" : "Off",
          },
        ],
        { [action.setting]: action.enabled },
      );
    case "manage_billing":
      return {
        text: "Open Cards & wallets to add, edit, or remove a saved payment label.",
        next: { label: "Open Cards & wallets", route: "/billing-methods" },
      };
    case "list_billing": {
      const profile = await billingMethods(identity);
      const sources = profile.sources.filter(
        (source) => source.kind !== "bank",
      );
      return {
        text: sources.length
          ? "Here are your saved payment labels."
          : "You haven’t saved a card or wallet yet.",
        title: "Cards & wallets",
        rows: sources.slice(0, 10).map((source) => ({
          label: source.kind === "card" ? "Card" : "Wallet",
          value: billingMethodLabel(source),
        })),
        next: { label: "Open Cards & wallets", route: "/billing-methods" },
      };
    }
  }
}
