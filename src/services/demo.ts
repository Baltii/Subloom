import { catalog } from "../domain/catalog";
import {
  emptySnapshot,
  type Preferences,
  type Subscription,
} from "../domain/models";
import { today } from "../domain/renewal";
import { Temporal } from "@js-temporal/polyfill";
export function demoSnapshot(preferences: Preferences) {
  const reference = Temporal.PlainDate.from(today(preferences.timezone)),
    now = new Date().toISOString();
  const examples = [
    { service: "spotify", price: 1099, days: 2, interval: "monthly" },
    { service: "netflix", price: 1549, days: 4, interval: "monthly" },
    { service: "icloud", price: 299, days: 6, interval: "monthly" },
    { service: "notion", price: 1000, days: 8, interval: "monthly" },
    { service: "figma", price: 1500, days: 12, interval: "monthly" },
    { service: "youtube", price: 1399, days: 15, interval: "monthly" },
    { service: "chatgpt", price: 2000, days: 18, interval: "monthly" },
    { service: "amazon", price: 13900, days: 23, interval: "yearly" },
  ] as const;
  const subscriptions: Subscription[] = examples.map((item, i) => {
    const service = catalog.find((s) => s.id === item.service)!,
      nextRenewal = reference.add({ days: item.days }).toString();
    return {
      id: "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
      userId: "guest",
      serviceId: service.id,
      name: service.name,
      category: service.category,
      amountMinor: item.price,
      currency: "USD",
      interval: item.interval,
      intervalCount: 1,
      customUnit: "day",
      startDate: reference.subtract({ months: 3 }).toString(),
      nextRenewal,
      anchorDay: Number(nextRenewal.slice(-2)),
      trialEnd: null,
      canceledAt: null,
      paidThrough: null,
      status: "active",
      paymentMethod: "",
      notes:
        "Illustrative sample subscription. Prices are examples, not catalog recommendations.",
      source: "manual",
      reminders: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  });
  return { ...emptySnapshot(), subscriptions, preferences, demo: true };
}
