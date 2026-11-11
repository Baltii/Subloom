import { expect, it } from "vitest";
import {
  assistantDateRange,
  type AssistantAnalytics,
} from "../../src/domain/assistantDateRange";
import {
  assistantConversationResponseSchema,
  assistantV2ResponseSchema,
} from "../../src/domain/assistantProtocol";
import type { ExchangeRate } from "../../src/domain/exchangeRates";
import { interpretLocalAssistant } from "../../src/domain/localAssistant";
import type { PaymentTransaction } from "../../src/domain/radar";
import { assistantAnalytics } from "../../src/services/assistantAnalytics";
import { subscription } from "../fixtures";

const rates: ExchangeRate[] = Object.entries({
  EUR: "0.9",
  TND: "3",
  JPY: "150",
}).map(([quote, rate]) => ({
  base_currency: "USD",
  quote_currency: quote as ExchangeRate["quote_currency"],
  rate,
  as_of: "2026-11-10",
  fetched_at: "2026-11-10T00:00:00Z",
  provider: "frankfurter",
}));
const context = { currency: "USD", rates } as const;
function analytics(
  patch: Partial<AssistantAnalytics> = {},
): AssistantAnalytics {
  return {
    kind: "analytics",
    metric: "spending",
    period: "next_month",
    from: null,
    through: null,
    subscription: null,
    ...patch,
  };
}
function plan(date: string, name: string, amountMinor = 1000) {
  return subscription({
    name,
    startDate: "2026-01-01",
    nextRenewal: date,
    anchorDay: Number(date.slice(-2)),
    amountMinor,
  });
}
function debit(patch: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    fingerprint: "a".repeat(64),
    date: "2026-11-11",
    merchant: "Spotify",
    amountMinor: 1000,
    currency: "USD",
    direction: "debit",
    sourceId: null,
    reference: "",
    subscriptionId: subscription().id,
    ignored: false,
    importedAt: "2026-11-11T12:00:00Z",
    ...patch,
  };
}

it("interprets the reported weekly, monthly, and remaining requests distinctly", () => {
  for (const [text, metric, period] of [
    ["How much I will pay next week?", "spending", "next_week"],
    ["How much will I spend next month?", "spending", "next_month"],
    ["How much REST TO PAY this month?", "remaining", "this_month"],
    ["What is left to pay this month?", "remaining", "this_month"],
    ["How much will I pay in the next 7 days?", "spending", "next_7_days"],
  ])
    expect(interpretLocalAssistant(text!, false)).toMatchObject({
      kind: "analytics",
      metric,
      period,
    });
});

it("uses next Monday through Sunday and a separate rolling seven-day window", () => {
  expect(
    assistantDateRange(analytics({ period: "next_week" }), "2026-11-11"),
  ).toMatchObject({ from: "2026-11-16", end: "2026-11-23" });
  expect(
    assistantDateRange(analytics({ period: "next_7_days" }), "2026-11-11"),
  ).toMatchObject({ from: "2026-11-11", end: "2026-11-18" });
  expect(
    assistantDateRange(analytics({ period: "next_week" }), "2026-12-31"),
  ).toMatchObject({ from: "2027-01-04", end: "2027-01-11" });
  expect(
    assistantDateRange(analytics({ period: "next_week" }), "2026-11-16"),
  ).toMatchObject({ from: "2026-11-23", end: "2026-11-30" });
});

it("includes both weekly boundaries without leaking later subscriptions", () => {
  const reply = assistantAnalytics(
    analytics({ period: "next_week" }),
    [
      plan("2026-11-15", "Before"),
      plan("2026-11-16", "Monday"),
      plan("2026-11-22", "Sunday"),
      plan("2026-11-23", "After"),
      plan("2026-12-01", "Next month"),
    ],
    "2026-11-11",
    context,
  );
  expect(reply.title).toBe("Estimated spending · Nov 16, 2026 to Nov 22, 2026");
  expect(reply.rows?.map((row) => row.label)).toEqual([
    "Total · USD",
    "Monday",
    "Sunday",
  ]);
  expect(reply.rows?.[0]?.value).toBe("$20.00");
});

it("converts every scheduled price into the selected currency including minor-unit differences", () => {
  const plans = [
    plan("2026-12-02", "USD plan", 2000),
    { ...plan("2026-12-05", "EUR plan", 900), currency: "EUR" as const },
    { ...plan("2026-12-06", "JPY plan", 1500), currency: "JPY" as const },
  ];
  const original = structuredClone(plans);
  const reply = assistantAnalytics(analytics(), plans, "2026-11-11", {
    currency: "TND",
    rates,
  });
  expect(reply.rows?.[0]).toEqual({
    label: "Total · TND",
    value: "TND 120.000",
  });
  expect(reply.rows?.slice(1).every((row) => row.value.includes("TND"))).toBe(
    true,
  );
  expect(plans).toEqual(original);
});

it("does not label an incomplete conversion as a valid total", () => {
  const reply = assistantAnalytics(
    analytics(),
    [
      plan("2026-12-01", "USD plan"),
      { ...plan("2026-12-02", "SAR plan"), currency: "SAR" },
    ],
    "2026-11-11",
    { currency: "EUR", rates },
  );
  expect(reply.rows?.[0]).toEqual({
    label: "Total · EUR",
    value: "Rate unavailable",
  });
  expect(reply.rows?.[2]?.value).toContain("Rate unavailable");
  expect(reply.text).toContain("exchange rate is missing");
});

it("excludes elapsed monthly payments while retaining future weekly occurrences", () => {
  const reply = assistantAnalytics(
    analytics({ metric: "remaining", period: "this_month" }),
    [
      plan("2026-11-03", "Already passed", 5000),
      { ...plan("2026-11-04", "Weekly", 1000), interval: "weekly" },
      { ...plan("2026-11-20", "Paused", 9999), status: "paused" },
      {
        ...plan("2026-11-22", "Canceled", 9999),
        status: "canceled",
        paidThrough: "2026-11-22",
      },
    ],
    "2026-11-11",
    { ...context, transactions: [debit()] },
  );
  expect(reply.title).toBe(
    "Remaining scheduled payments · Nov 11, 2026 to Nov 30, 2026",
  );
  expect(reply.rows?.map((row) => row.label)).toEqual([
    "Total · USD",
    "Weekly",
    "Weekly",
  ]);
  expect(reply.rows?.[0]?.value).toBe("$20.00");
  expect(reply.rows?.[1]?.value).toContain("Nov 18");
  expect(reply.rows?.[2]?.value).toContain("Nov 25");
});

it("deducts only eligible recorded debits without confusing refunds, matches or partial payments", () => {
  const reply = assistantAnalytics(
    analytics({ metric: "remaining", period: "today" }),
    [plan("2026-11-11", "Today", 2000)],
    "2026-11-11",
    {
      ...context,
      transactions: [
        debit({ amountMinor: 500 }),
        debit({ ignored: true }),
        debit({ direction: "credit" }),
        debit({ currency: "EUR" }),
        debit({ date: "2026-11-10" }),
        debit({ subscriptionId: null }),
      ],
    },
  );
  expect(reply.rows?.[0]?.value).toBe("$15.00");
  expect(reply.rows?.[1]?.value).toContain("$15.00");
});

it("keeps the whole-month forecast distinct from the remaining-month forecast", () => {
  const plans = [
    plan("2026-11-03", "Earlier", 1000),
    plan("2026-11-18", "Later", 2000),
  ];
  const full = assistantAnalytics(
    analytics({ period: "this_month" }),
    plans,
    "2026-11-11",
    context,
  );
  const remaining = assistantAnalytics(
    analytics({ metric: "remaining", period: "this_month" }),
    plans,
    "2026-11-11",
    context,
  );
  expect(full.rows?.[0]?.value).toBe("$30.00");
  expect(remaining.rows?.[0]?.value).toBe("$20.00");
});

it("reports zero remaining for a period that has already ended", () => {
  const reply = assistantAnalytics(
    analytics({
      metric: "remaining",
      period: "dates",
      from: "2026-11-01",
      through: "2026-11-05",
    }),
    [plan("2026-11-03", "Past plan")],
    "2026-11-11",
    context,
  );
  expect(reply.title).toBe(
    "Remaining scheduled payments · Nov 1, 2026 to Nov 5, 2026",
  );
  expect(reply.rows).toEqual([{ label: "Total · USD", value: "$0.00" }]);
});

it("converts recurring totals, category breakdowns, and highest-cost rankings consistently", () => {
  const plans = [
    plan("2026-12-02", "USD plan", 2000),
    { ...plan("2026-12-05", "EUR plan", 900), currency: "EUR" as const },
  ];
  const reply = (metric: AssistantAnalytics["metric"]) =>
    assistantAnalytics(analytics({ metric }), plans, "2026-11-11", {
      currency: "EUR",
      rates,
    });
  expect(reply("recurring").rows).toEqual([
    { label: "Total · EUR", value: "€27.00" },
  ]);
  expect(reply("by_category").rows?.[1]).toEqual({
    label: "Music",
    value: "€27.00",
  });
  expect(reply("most_expensive").rows?.slice(1)).toEqual([
    { label: "USD plan", value: "€18.00" },
    { label: "EUR plan", value: "€9.00" },
  ]);
});

it("rejects invalid date ranges and keeps new analytics out of the v2 response contract", () => {
  expect(
    assistantDateRange(
      analytics({ period: "dates", from: "2026-11-20", through: "2026-11-10" }),
      "2026-11-11",
    ),
  ).toBeNull();
  expect(
    assistantDateRange(
      analytics({ period: "dates", from: "2026-01-01", through: "2027-12-31" }),
      "2026-11-11",
    ),
  ).toBeNull();
  const action = analytics({ metric: "remaining", period: "next_week" });
  expect(
    assistantConversationResponseSchema.safeParse({ action }).success,
  ).toBe(true);
  expect(assistantV2ResponseSchema.safeParse({ action }).success).toBe(false);
});
