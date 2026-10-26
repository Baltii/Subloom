import { Temporal } from "@js-temporal/polyfill";
import type { Preferences, Subscription } from "../../../src/domain/models.ts";
import { billingEvents } from "../../../src/domain/schedule.ts";
import {
  dateLabel,
  intervalLabel,
  today,
} from "../../../src/domain/renewal.ts";
import {
  convertMinor,
  type ExchangeRate,
} from "../../../src/domain/exchangeRates.ts";
import { formatMoney } from "../../../src/domain/money.ts";
import { weeklyDigestNotification } from "./notification-emails.ts";

/** The same date-only billing events and conversion/rounding rules as the app. */
export function weeklyDigest(
  subscriptions: Subscription[],
  preferences: Pick<Preferences, "timezone" | "currency">,
  rates: ExchangeRate[],
  now = new Date(),
) {
  const start = today(preferences.timezone, now);
  const end = Temporal.PlainDate.from(start).add({ days: 7 }).toString();
  const events = billingEvents(subscriptions, start, end).filter((event) =>
    event.type !== "paid_through"
  );
  const money = (amount: number) => {
    const formatted = formatMoney(amount, preferences.currency);
    return formatted.includes(preferences.currency)
      ? formatted
      : `${formatted} ${preferences.currency}`;
  };
  let total = 0;
  const rows = events.map((event) => {
    // A missing rate defers delivery, so a partial total is never emailed as a complete one.
    const amount = convertMinor(
      event.subscription.amountMinor,
      event.subscription.currency,
      preferences.currency,
      rates,
    );
    total += amount;
    if (!Number.isSafeInteger(total)) {
      throw new Error("Weekly estimate is too large.");
    }
    return {
      name: event.subscription.name,
      serviceId: event.subscription.serviceId,
      date: dateLabel(event.date, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      amount: money(amount),
      cycle: intervalLabel(event.subscription),
      kind: event.type as "renewal" | "trial",
      path: `/subscription/${event.subscription.id}`,
    };
  });
  return weeklyDigestNotification(
    rows.length,
    money(total),
    rows,
    `${dateLabel(start)} – ${
      dateLabel(Temporal.PlainDate.from(end).subtract({ days: 1 }).toString())
    }`,
  );
}
