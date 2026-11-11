import { randomUUID } from "expo-crypto";
import type { Href } from "expo-router";
import type {
  AssistantAction,
  AssistantBillingChange,
} from "../domain/assistantProtocol";
import {
  assistantSubscriptionRows,
  editAssistantSubscription,
} from "../domain/assistantSubscriptionEdits";
import {
  billingMethodLabel,
  billingReference,
  buildBillingMethod,
  subscriptionBillingLabel,
  subscriptionBillingValue,
  unassignedBillingMethod,
} from "../domain/billingMethods";
import { quickAddDates } from "../domain/calendarEvents";
import { savedServiceForName } from "../domain/customServices";
import {
  dateSchema,
  type Preferences,
  type Subscription,
} from "../domain/models";
import { formatMoney, parseMoney } from "../domain/money";
import {
  cardBrands,
  emptyPaymentProfile,
  paymentProfileSchema,
  removePaymentSource,
  walletProviders,
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
import {
  deleteSubscription,
  saveSubscription,
  updatePreferences,
  useApp,
} from "../store/app";
import { readSetting, writeSetting } from "./featureSettings";
import { assistantAnalytics } from "./assistantAnalytics";

type Row = { label: string; value: string };
export type AssistantReply = {
  text: string;
  title?: string;
  rows?: Row[];
  awaitingDetails?: boolean;
  next?:
    | { label: string; route: Href }
    | { label: string; run: () => Promise<string>; danger?: boolean };
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
      [
        item.name,
        billingMethodLabel(item),
        item.walletProvider,
        item.cardBrand,
        item.last4,
      ].some((name) => name && normalize(name) === text),
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

async function billingSetting(identity: string) {
  assistantWorkspace(identity);
  const setting = await readSetting(
    identity,
    "payment_sources",
    paymentProfileSchema,
    emptyPaymentProfile,
  );
  assistantWorkspace(identity);
  return setting;
}

async function billingMethods(identity: string) {
  return (await billingSetting(identity)).value;
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

async function resolveBillingChange(
  action: AssistantBillingChange,
  identity: string,
  subscriptions: Subscription[],
): Promise<AssistantReply> {
  if (action.operation !== "add" && !action.method?.trim())
    return ask(
      "Which saved card or wallet should I " +
        (action.operation === "edit" ? "edit" : "remove") +
        "?",
    );
  const reviewed = await billingSetting(identity);
  const matches =
    action.operation !== "add" && action.method
      ? billingMatches(reviewed.value, action.method)
      : [];
  const [source] = matches;
  if (action.operation !== "add" && !source)
    return ask("I couldn’t find that card or wallet. What is its saved label?");
  if (matches.length > 1)
    return ask(
      "Which saved payment label should I use?",
      matches
        .slice(0, 5)
        .map((item) => ({ label: billingMethodLabel(item), value: item.kind })),
    );
  const save = async (value: PaymentProfile) => {
    const latest = await billingSetting(identity);
    if (
      latest.version !== reviewed.version ||
      JSON.stringify(latest.value) !== JSON.stringify(reviewed.value)
    )
      throw new Error(
        "Your payment methods changed. Ask again to review the latest version.",
      );
    assistantWorkspace(identity);
    await writeSetting(
      identity,
      "payment_sources",
      paymentProfileSchema,
      value,
      reviewed.version,
    );
  };
  if (action.operation === "delete" && source) {
    const links = subscriptions.filter(
      (item) =>
        subscriptionBillingValue(item, reviewed.value) ===
        billingReference(source.id),
    ).length;
    return {
      title: billingMethodLabel(source),
      text: "Remove this saved payment label from Subloom?",
      rows: [{ label: "Linked subscriptions", value: String(links) }],
      next: {
        label: "Remove payment method",
        danger: true,
        run: async () => {
          await save(removePaymentSource(reviewed.value, source.id));
          return "The payment method was removed from Subloom.";
        },
      },
    };
  }
  const type = source?.kind ?? action.type;
  if (type !== "card" && type !== "wallet")
    return ask("Is this a card or a wallet?");
  if (source && action.type && source.kind !== action.type)
    return ask(
      "Choose an existing label of that type, or ask to add a new payment method.",
    );
  const brand = action.brand?.trim().toLowerCase();
  const cardBrand =
    brand && type === "card"
      ? cardBrands.find((item) => item.toLowerCase() === brand)
      : (source?.cardBrand ?? "Other card");
  const walletProvider =
    brand && type === "wallet"
      ? walletProviders.find((item) => item.toLowerCase() === brand)
      : (source?.walletProvider ?? "Other wallet");
  const last4 = action.last4 ?? source?.last4 ?? "";
  const nickname = action.name ?? source?.name ?? "";
  if (!cardBrand || !walletProvider)
    return ask(
      "Which card brand or wallet provider is it? You can say “other” and give it a nickname.",
    );
  if (type === "card" && !/^\d{4}$/.test(last4))
    return ask("What are the last four digits of the card?");
  if (
    !nickname.trim() &&
    (type === "wallet"
      ? walletProvider === "Other wallet"
      : cardBrand === "Other card")
  )
    return ask("What nickname should I use for this payment method?");
  if (
    source &&
    action.name === null &&
    action.brand === null &&
    action.last4 === null
  )
    return ask(
      "Which detail should I change, such as the nickname or card brand?",
    );
  let next: PaymentSource;
  try {
    next = buildBillingMethod(
      { kind: type, cardBrand, walletProvider, nickname, last4 },
      source?.id ?? randomUUID(),
      new Date().toISOString(),
      source,
    );
  } catch {
    return ask("Check the nickname and payment details, then try again.");
  }
  return {
    title: source ? billingMethodLabel(source) : "New payment method",
    text: "Review this saved payment label.",
    rows: [{ label: "Label", value: billingMethodLabel(next) }],
    next: {
      label: source ? "Save payment method" : "Add payment method",
      run: async () => {
        await save({
          ...reviewed.value,
          sources: [
            ...reviewed.value.sources.filter((item) => item.id !== next.id),
            next,
          ],
        });
        return "The payment method was saved in Subloom.";
      },
    },
  };
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
        text: "Ask what you’ll spend next month, add or edit a subscription, manage a saved card or wallet, or change display and reminder settings.",
      };
    case "clarify":
      return ask(
        "Tell me one thing you’d like to do and include the saved name if it’s about a subscription or wallet.",
      );
    case "analytics": {
      if (!action.subscription)
        return assistantAnalytics(action, subscriptions, reference);
      const matches = matchName(subscriptions, action.subscription, (item) => [
        item.name,
      ]);
      if (matches.length !== 1)
        return ask(
          "Which saved subscription should I use?",
          matches.slice(0, 5).map((item) => ({
            label: item.name,
            value: formatMoney(item.amountMinor, item.currency),
          })),
        );
      return assistantAnalytics(action, matches, reference);
    }
    case "payment_method":
      return resolveBillingChange(action, identity, subscriptions);
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
    case "edit_subscription":
    case "delete_subscription":
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
      if (action.kind === "delete_subscription") {
        return {
          title: subscription.name,
          text: "Delete this subscription and its price history from Subloom? To stop future charges, cancel with the provider.",
          rows: [
            {
              label: "Price",
              value:
                formatMoney(subscription.amountMinor, subscription.currency) +
                " · " +
                intervalLabel(subscription),
            },
          ],
          next: {
            label: "Delete subscription",
            danger: true,
            run: async () => {
              assistantWorkspace(identity);
              await deleteSubscription(
                subscription.id,
                subscription.version,
                identity,
              );
              return subscription.name + " was deleted from Subloom.";
            },
          },
        };
      }
      if (action.kind === "edit_subscription") {
        if (
          subscription.proBillingOwner &&
          (!action.changes.length ||
            action.changes.some(
              ({ field }) =>
                ![
                  "notes",
                  "paymentMethod",
                  "reminderDays",
                  "remindersEnabled",
                ].includes(field),
            ))
        )
          return {
            text: "Open Subloom Pro to manage this plan’s billing.",
            next: { label: "Open Subloom Pro", route: "/pro" },
          };
        if (!action.changes.length)
          return {
            text: "Tell me which field to change, or open the full edit form.",
            awaitingDetails: true,
            next: {
              label: "Open subscription form",
              route: {
                pathname: "/subscription/edit",
                params: { id: subscription.id },
              },
            },
          };
        const payment = action.changes.find(
          ({ field }) => field === "paymentMethod",
        );
        const methods = payment?.value
          ? billingMatches(await billingMethods(identity), payment.value)
          : [];
        if (payment?.value && methods.length !== 1)
          return ask(
            "Which saved card or wallet should I use?",
            methods.slice(0, 5).map((item) => ({
              label: billingMethodLabel(item),
              value: item.kind,
            })),
          );
        const [method] = methods;
        const referenceValue = payment
          ? method
            ? billingReference(method.id)
            : unassignedBillingMethod
          : undefined;
        let changed: Subscription;
        try {
          changed = editAssistantSubscription(
            subscription,
            action.changes,
            reference,
            referenceValue,
          );
        } catch (error) {
          return ask(
            error instanceof Error
              ? error.message
              : "Check the subscription details and try again.",
          );
        }
        const rows = assistantSubscriptionRows(subscription, changed);
        if (payment && changed.paymentMethod !== subscription.paymentMethod)
          rows.push({
            label: "Payment method",
            value: method ? billingMethodLabel(method) : "Not assigned",
          });
        if (!rows.length)
          return {
            text: "Those details already match " + subscription.name + ".",
          };
        return {
          title: subscription.name,
          text: "Review these subscription changes.",
          rows,
          next: {
            label: "Save subscription changes",
            run: async () => {
              if (method) await verifiedBillingReference(identity, method);
              assistantWorkspace(identity);
              await saveSubscription(
                changed,
                undefined,
                subscription.version,
                identity,
              );
              return changed.name + " was updated in Subloom.";
            },
          },
        };
      }
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
      const custom = action.details?.some(
        ({ field, value }) => field === "interval" && value === "custom",
      );
      const frequency: Subscription["interval"] | null = custom
        ? "custom"
        : interval;
      if (
        custom &&
        !["intervalCount", "customUnit"].every((key) =>
          action.details?.some(({ field }) => field === key),
        )
      )
        return ask("How often does this bill? For example, every two weeks.");
      const cadence = frequency && {
        interval: frequency,
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
        !frequency && "billing frequency",
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
      const service = savedServiceForName(name, preferences.customServices);
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
      const now = new Date().toISOString();
      const base: Subscription = {
        id: randomUUID(),
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
        paymentMethod: source
          ? billingReference(source.id)
          : unassignedBillingMethod,
        notes: "",
        source: "manual",
        reminders: null,
        createdAt: now,
        updatedAt: now,
        version: 0,
      };
      let draft: Subscription;
      try {
        draft = action.details?.length
          ? editAssistantSubscription(base, action.details, reference)
          : base;
      } catch (error) {
        return ask(
          error instanceof Error ? error.message : "Check the draft details.",
        );
      }
      const changedCadence =
        draft.intervalCount !== cadence.intervalCount ||
        draft.customUnit !== cadence.customUnit;
      if (changedCadence && startDate && !explicitRenewal) {
        draft.nextRenewal =
          nextEvent(
            {
              ...draft,
              status: "active",
              trialEnd: null,
              nextRenewal: advanceRenewal(startDate, draft),
            },
            reference,
          )?.date ?? draft.nextRenewal;
      }
      return {
        text: "Check these details before adding the subscription.",
        title: draft.name,
        rows: [
          {
            label: "Price",
            value:
              formatMoney(draft.amountMinor, draft.currency) +
              " · " +
              (draft.interval === "custom" || draft.intervalCount > 1
                ? intervalLabel(draft)
                : draft.interval),
          },
          { label: "Start date", value: localDate(draft.startDate) },
          { label: "Next renewal", value: localDate(draft.nextRenewal) },
          {
            label: "Payment method",
            value: source ? billingMethodLabel(source) : "Not assigned",
          },
          { label: "Category", value: draft.category },
          ...assistantSubscriptionRows(base, draft).filter(
            ({ label }) =>
              ![
                "Name",
                "Price",
                "Category",
                "Start date",
                "Next renewal",
                "Billing schedule",
              ].includes(label),
          ),
        ],
        next: {
          label: "Add subscription",
          run: async () => {
            const paymentMethod = source
              ? await verifiedBillingReference(identity, source)
              : unassignedBillingMethod;
            const current = assistantWorkspace(identity);
            if (current.subscriptions.some((item) => item.id === draft.id))
              return draft.name + " was added.";
            if (
              current.subscriptions.some(
                (item) =>
                  item.userId === identity &&
                  item.name.toLowerCase() === draft.name.toLowerCase() &&
                  item.amountMinor === draft.amountMinor &&
                  item.currency === draft.currency &&
                  item.interval === draft.interval &&
                  item.intervalCount === draft.intervalCount &&
                  item.customUnit === draft.customUnit &&
                  item.nextRenewal === draft.nextRenewal,
              )
            )
              throw new Error(
                "A subscription with those details is already saved.",
              );
            await saveSubscription(
              { ...draft, paymentMethod },
              undefined,
              undefined,
              identity,
            );
            return draft.name + " was added.";
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
