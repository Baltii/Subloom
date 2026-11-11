import {
  assistantDateRange,
  type AssistantAnalytics,
} from "../domain/assistantDateRange";
import { currencyDisplay } from "../domain/displayCurrency";
import type { ExchangeRate } from "../domain/exchangeRates";
import type { Currency, Subscription } from "../domain/models";
import { recurringTotals } from "../domain/money";
import type { PaymentTransaction } from "../domain/radar";
import { dateLabel } from "../domain/renewal";
import { billingEvents } from "../domain/schedule";
import type { AssistantReply } from "./assistantActions";

type AnalyticsContext = {
  currency: Currency;
  rates: ExchangeRate[];
  transactions?: PaymentTransaction[];
  ratesWarning?: string | null;
};

export function assistantAnalytics(
  action: AssistantAnalytics,
  subscriptions: Subscription[],
  today: string,
  context: AnalyticsContext,
): AssistantReply {
  const display = currencyDisplay(context.currency, context.rates);
  const totalRow = (amountMinor: number | null) => ({
    label: "Total · " + context.currency,
    value:
      amountMinor === null ? "Rate unavailable" : display.format(amountMinor),
  });
  const conversionNote = (missing: boolean) =>
    missing
      ? " A complete total is unavailable because an exchange rate is missing."
      : subscriptions.some((item) => item.currency !== context.currency)
        ? " Converted estimates in " +
          context.currency +
          "." +
          (context.ratesWarning ? " Using cached exchange rates." : "")
        : "";

  if (action.metric === "recurring") {
    const annual =
      action.period === "this_year" || action.period === "next_year";
    const totals = recurringTotals(subscriptions);
    const amount = display.total(
      totals.map(({ currency, monthly, annual: yearly }) => ({
        currency,
        amountMinor: annual ? yearly : monthly,
      })),
    );
    return {
      title: annual ? "Average yearly cost" : "Average monthly cost",
      text:
        (totals.length
          ? "Based on the billing frequency of active plans and trials."
          : "There are no active plans or trials in this selection.") +
        conversionNote(amount === null),
      rows: [totalRow(amount)],
    };
  }

  const range = assistantDateRange(action, today);
  if (!range)
    return {
      text: "Which dates should I use? Choose a start and end date within one year.",
      awaitingDetails: true,
    };
  const remaining = action.metric === "remaining";
  const events =
    range.from >= range.end
      ? []
      : billingEvents(subscriptions, range.from, range.end).filter((event) =>
          action.metric === "trials"
            ? event.type === "trial"
            : action.metric === "renewals"
              ? event.type === "renewal"
              : event.type !== "paid_through",
        );
  const charges = events
    .map((event) => {
      // Only an explicitly linked, non-ignored debit on the due date offsets a
      // scheduled charge. Never guess payments from merchant names or month totals:
      // a weekly plan can have several separate charges in the same month.
      const paid = remaining
        ? (context.transactions ?? [])
            .filter(
              (transaction) =>
                transaction.subscriptionId === event.subscription.id &&
                transaction.date === event.date &&
                transaction.date <= today &&
                transaction.currency === event.subscription.currency &&
                transaction.direction === "debit" &&
                !transaction.ignored,
            )
            .reduce((sum, transaction) => sum + transaction.amountMinor, 0)
        : 0;
      return {
        event,
        currency: event.subscription.currency,
        amountMinor: Math.max(0, event.subscription.amountMinor - paid),
      };
    })
    .filter((charge) => !remaining || charge.amountMinor > 0);
  const title =
    {
      spending: "Estimated spending",
      remaining: "Remaining scheduled payments",
      renewals: "Renewals",
      trials: "Trial endings",
      by_category: "Spending by category",
      most_expensive: "Highest scheduled spending",
    }[action.metric] +
    " · " +
    range.label;
  const monetary = action.metric !== "trials";
  const total = display.total(charges);
  if (!charges.length)
    return {
      title,
      text: remaining
        ? "There are no remaining scheduled payments in this period."
        : "There are no matching events in this period.",
      rows: monetary ? [totalRow(0)] : undefined,
    };

  const grouped =
    action.metric === "by_category" || action.metric === "most_expensive";
  const groups = new Map<string, { name: string; amounts: typeof charges }>();
  if (grouped)
    for (const charge of charges) {
      const name =
        action.metric === "by_category"
          ? charge.event.subscription.category
          : charge.event.subscription.name;
      const group = groups.get(name) ?? { name, amounts: [] };
      group.amounts.push(charge);
      groups.set(name, group);
    }
  const rows = grouped
    ? [...groups.values()]
        .map(({ name, amounts }) => ({ name, amount: display.total(amounts) }))
        .sort(
          (a, b) =>
            (b.amount ?? -1) - (a.amount ?? -1) || a.name.localeCompare(b.name),
        )
        .map(({ name, amount }) => ({
          label: name,
          value: amount === null ? "Rate unavailable" : display.format(amount),
        }))
    : charges.map(
        ({ event: { subscription, date, type }, amountMinor, currency }) => ({
          label: subscription.name,
          value:
            dateLabel(date, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }) +
            (type === "trial" ? " · Trial ends" : "") +
            (monetary ? " · " + display.format(amountMinor, currency) : ""),
        }),
      );
  // Do not rank an incomplete conversion as if the missing plans cost zero.
  const incompleteRanking =
    action.metric === "most_expensive" && total === null;
  const text =
    (remaining
      ? "Scheduled from today within the selected period; earlier dates are excluded. Linked imported debits on their due date reduce the amount remaining."
      : "Based on your saved billing schedules.") +
    (monetary ? conversionNote(total === null) : "") +
    (rows.length > 12
      ? " Showing 12 of " +
        rows.length +
        (grouped ? " entries." : " scheduled events.")
      : "");
  return {
    title,
    text: incompleteRanking
      ? text + " A complete ranking needs all exchange rates."
      : text,
    rows: [...(monetary ? [totalRow(total)] : []), ...rows.slice(0, 12)],
    next: { label: "Open calendar", route: "/calendar" },
  };
}
