import { catalog } from "./catalog.ts";
import {
  currencies,
  type Candidate,
  type Currency,
  type Interval,
  type Subscription,
} from "./models.ts";
import { parseMoney } from "./money.ts";
import { advanceRenewal } from "./renewal.ts";

// Tunable product policy. Confidence is a parser heuristic, not a probability.
export const detectionThresholds = { high: 0.8, medium: 0.5 } as const;
export function confidenceLevel(
  score: number,
  thresholds: { high: number; medium: number } = detectionThresholds,
): "high" | "medium" | "low" {
  if (
    thresholds.medium < 0 ||
    thresholds.high > 1 ||
    thresholds.medium > thresholds.high
  )
    throw new Error("Invalid confidence thresholds.");
  return score >= thresholds.high
    ? "high"
    : score >= thresholds.medium
      ? "medium"
      : "low";
}

export function normalizeReceipt(text: string): string {
  if (text.length > 100_000)
    throw new Error("Receipt text exceeds the 100 KB limit.");
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[\u0000-\u0008\u000E-\u001F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}
export function classifyReceipt(text: string): Candidate["kind"] {
  if (/\b(refund(?:ed)?|chargeback)\b/i.test(text)) return "refund";
  if (/\b(cancel(?:ed|led|lation)|terminated)\b/i.test(text))
    return "cancellation";
  if (
    /\b(price (?:change|increase)|new price|plan (?:upgrade|change))\b/i.test(
      text,
    )
  )
    return "price_change";
  if (/\b(one[- ]time|non[- ]recurring)\b/i.test(text)) return "one_time";
  if (/\b(renewed|renewal receipt|renewal confirmation)\b/i.test(text))
    return "renewal";
  if (
    /\b(subscription|membership|recurring|billed (?:monthly|annually)|free trial|per month|per year)\b/i.test(
      text,
    )
  )
    return "new";
  return "unknown";
}
// A stable evidence identifier, not a credential or authentication primitive.
export function fingerprint(text: string): string {
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return (
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
function dateAfter(text: string, label: RegExp): string | null {
  const match = text.match(label),
    value = match?.[1];
  if (!value) return null;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}
export function extractReceipt(
  raw: string,
  id: string,
  source: Candidate["source"] = "receipt",
  now = new Date(),
): Candidate {
  const text = normalizeReceipt(raw),
    kind = classifyReceipt(text);
  if (!text) throw new Error("No readable text was found in this receipt.");
  const service =
    catalog.find((s) => text.toLowerCase().includes(s.name.toLowerCase())) ||
    catalog.find(
      (s) =>
        [
          "adobe",
          "icloud",
          "youtube",
          "google",
          "microsoft",
          "amazon",
        ].includes(s.id) && text.toLowerCase().includes(s.id),
    );
  const merchant =
    service?.name ||
    text.match(/(?:merchant|service|from):?\s*([^\n]{2,60})/i)?.[1]?.trim() ||
    "Unknown service";
  const currencyCodes = [
    ...new Set(
      [...text.matchAll(/\b(USD|EUR|GBP|CAD|AUD|TND|JPY|CHF|AED|INR)\b/gi)].map(
        (m) => m[1]!.toUpperCase(),
      ),
    ),
  ];
  if (text.includes("€") && !currencyCodes.includes("EUR"))
    currencyCodes.push("EUR");
  if (text.includes("£") && !currencyCodes.includes("GBP"))
    currencyCodes.push("GBP");
  const currencyMatch =
    currencyCodes.length === 1 ? currencyCodes[0] : undefined;
  const currency =
    currencyMatch && currencies.includes(currencyMatch as Currency)
      ? (currencyMatch as Currency)
      : null;
  const prices = [
    ...text.matchAll(
      /(?:USD|EUR|GBP|CAD|AUD|TND|JPY|CHF|AED|INR|[$€£¥])\s*([0-9]{1,9}(?:\.[0-9]{1,3})?)/gi,
    ),
  ];
  const distinctPrices = [...new Set(prices.map((p) => p[1]))];
  const price =
    distinctPrices.length > 1
      ? undefined
      : distinctPrices[0] ||
        text.match(
          /(?:amount|price|total)\s*:?\s*([0-9]+(?:\.[0-9]{1,3})?)/i,
        )?.[1];
  let amountMinor: number | null = null;
  try {
    if (price && currency) amountMinor = parseMoney(price, currency);
  } catch {
    /* Uncertain money stays missing for review. */
  }
  const interval: Interval | null =
    /\b(annual(?:ly)?|yearly|per year|\/year)\b/i.test(text)
      ? "yearly"
      : /\b(quarterly|per quarter)\b/i.test(text)
        ? "quarterly"
        : /\b(monthly|per month|\/month)\b/i.test(text)
          ? "monthly"
          : /\b(weekly|per week|\/week)\b/i.test(text)
            ? "weekly"
            : null;
  const chargeDate =
    dateAfter(
      text,
      /\b(?:charged(?: on)?|purchase date|activation date|paid on)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
    ) || dateAfter(text, /(?:^|\n)\s*date\s*:?\s*(\d{4}-\d{2}-\d{2})/i);
  const explicitNext = dateAfter(
    text,
    /(?:next (?:renewal|payment|billing)|renews(?: on)?|renewal date)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
  );
  const trialEnd = dateAfter(
    text,
    /(?:trial ends(?: on)?|trial end|trial expires(?: on)?)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
  );
  const nextRenewal =
    explicitNext ||
    trialEnd ||
    (chargeDate && interval
      ? advanceRenewal(chargeDate, {
          interval,
          intervalCount: 1,
          customUnit: "day",
          anchorDay: Number(chargeDate.slice(-2)),
        })
      : null);
  const reference =
    text.match(
      /(?:invoice|transaction|order|reference)(?: id| number| #)?\s*[:#]?\s*([a-z0-9][a-z0-9_-]{4,80})/i,
    )?.[1] || null;
  const missingFields = [
    ...(!service && merchant === "Unknown service" ? ["merchant"] : []),
    ...(amountMinor === null ? ["amount"] : []),
    ...(!currency ? ["currency"] : []),
    ...(!interval ? ["billing interval"] : []),
    ...(!nextRenewal ? ["renewal date"] : []),
  ];
  const recurring = ["new", "renewal", "price_change"].includes(kind);
  const confidence = recurring
    ? Math.max(
        0.25,
        0.96 - missingFields.length * 0.14 - (explicitNext ? 0 : 0.08),
      )
    : 0.2;
  return {
    id,
    merchant: merchant.slice(0, 80),
    serviceId: service?.id || null,
    amountMinor,
    currency,
    interval,
    chargeDate,
    nextRenewal,
    trialEnd,
    confidence,
    source,
    fingerprint: fingerprint(text.toLowerCase().replace(/\s+/g, " ")),
    reference,
    missingFields,
    explanation:
      currencyCodes.length > 1 || distinctPrices.length > 1
        ? "Several currencies or prices were found. Confirm the recurring price and its currency; promotional and one-time amounts may differ."
        : recurring
          ? explicitNext
            ? "Recurring wording and an explicit renewal date were found. Confirm the merchant, price, and schedule."
            : "Recurring wording was found. Any inferred dates are estimates and need your confirmation."
          : "This may be a " +
            kind.replace("_", " ") +
            ". It has not been added to your subscriptions.",
    kind,
    matchedSubscriptionId: null,
    state: "pending",
    createdAt: now.toISOString(),
  };
}
export function duplicateCandidate(
  candidate: Candidate,
  existing: Candidate[],
): Candidate | undefined {
  return existing.find((other) => {
    if (other.fingerprint === candidate.fingerprint) return true;
    if (candidate.reference && other.reference)
      return (
        candidate.reference === other.reference &&
        candidate.serviceId === other.serviceId
      );
    return Boolean(
      candidate.serviceId &&
      candidate.chargeDate &&
      candidate.amountMinor !== null &&
      candidate.currency &&
      candidate.serviceId === other.serviceId &&
      candidate.chargeDate === other.chargeDate &&
      candidate.amountMinor === other.amountMinor &&
      candidate.currency === other.currency &&
      candidate.interval === other.interval &&
      candidate.nextRenewal === other.nextRenewal,
    );
  });
}
export function possibleMatch(
  candidate: Candidate,
  subscriptions: Subscription[],
): string | null {
  const matches = subscriptions.filter(
    (s) =>
      candidate.serviceId &&
      s.serviceId === candidate.serviceId &&
      s.currency === candidate.currency &&
      candidate.nextRenewal === s.nextRenewal &&
      candidate.interval === s.interval &&
      s.status !== "canceled" &&
      s.status !== "expired",
  );
  return matches.length === 1 ? matches[0]!.id : null;
}
