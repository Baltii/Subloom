import { subscriptionSchema, type Subscription } from "./models";
import { moneyInput, parseMoney } from "./money";
const columns = [
  "name",
  "category",
  "amount",
  "currency",
  "interval",
  "intervalCount",
  "customUnit",
  "startDate",
  "nextRenewal",
  "anchorDay",
  "status",
  "trialEnd",
  "canceledAt",
  "paidThrough",
  "paymentMethod",
  "notes",
] as const;
export const csvExample =
  "name,category,amount,currency,interval,startDate,nextRenewal\r\nSpotify,Music,10.99,USD,monthly,2026-10-11,2026-11-11";
function protect(value: string) {
  return /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
}
function unprotect(value: string) {
  return value.startsWith("'") && /^[\s]*[=+@-]/.test(value.slice(1))
    ? value.slice(1)
    : value;
}
export function exportCsv(subscriptions: Subscription[]) {
  const quote = (s: string) => '"' + protect(s).replace(/"/g, '""') + '"';
  return (
    columns.join(",") +
    "\r\n" +
    subscriptions
      .map((s) =>
        columns
          .map((key) =>
            quote(
              key === "amount"
                ? moneyInput(s.amountMinor, s.currency)
                : String(s[key] ?? ""),
            ),
          )
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}
export function parseCsv(
  input: string,
  delimiter: "," | ";" | "\t" = ",",
): string[][] {
  if (input.length > 2_000_000)
    throw new Error("CSV is limited to 2 MB and 500 subscriptions.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const source = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw new Error("Unexpected quote in CSV.");
      quoted = true;
      continue;
    }
    if (c === delimiter || c === "\r" || c === "\n") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== delimiter) {
        if (c === "\r" && source[i + 1] === "\n") i++;
        if (row.some((v) => v.length)) rows.push(row);
        row = [];
        if (rows.length > 501)
          throw new Error("CSV is limited to 500 subscriptions.");
      }
      continue;
    }
    if (closed) throw new Error("Unexpected text after a quoted CSV field.");
    cell += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  row.push(cell);
  if (row.some((v) => v.length)) rows.push(row);
  if (rows.length > 501)
    throw new Error("CSV is limited to 500 subscriptions.");
  return rows;
}
export function csvSubscriptions(
  input: string,
  identity: string,
  newId: () => string,
  now = new Date().toISOString(),
) {
  const [header, ...rows] = parseCsv(input);
  if (!header || !rows.length)
    throw new Error("Add a header and at least one subscription.");
  if (
    new Set(header).size !== header.length ||
    header.some((key) => !columns.includes(key as (typeof columns)[number]))
  )
    throw new Error(
      "Use unique supported CSV column names. Download the example first.",
    );
  for (const key of [
    "name",
    "amount",
    "currency",
    "interval",
    "startDate",
    "nextRenewal",
  ])
    if (!header.includes(key)) throw new Error("Missing column: " + key);
  return rows.map((values, index) => {
    try {
      if (values.length !== header.length)
        throw new Error("Column count does not match the header.");
      const r = Object.fromEntries(
        header.map((key, i) => [key, unprotect(values[i] ?? "")]),
      );
      const currency = subscriptionSchema.shape.currency.parse(r.currency);
      const day = Number(r.nextRenewal?.slice(-2));
      return subscriptionSchema.parse({
        id: newId(),
        userId: identity,
        serviceId: null,
        name: r.name,
        category: r.category || "Other",
        amountMinor: parseMoney(r.amount ?? "", currency),
        currency,
        interval: r.interval,
        intervalCount: r.intervalCount ? Number(r.intervalCount) : 1,
        customUnit: r.customUnit || "day",
        startDate: r.startDate,
        nextRenewal: r.nextRenewal,
        anchorDay: r.anchorDay ? Number(r.anchorDay) : day,
        status: r.status || "active",
        trialEnd: r.trialEnd || null,
        canceledAt: r.canceledAt || null,
        paidThrough: r.paidThrough || null,
        paymentMethod: r.paymentMethod || "",
        notes: r.notes || "",
        source: "manual",
        reminders: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    } catch (e) {
      throw new Error(
        "CSV row " +
          (index + 2) +
          ": " +
          (e instanceof Error ? e.message : "Invalid data"),
      );
    }
  });
}
export function csvFingerprint(s: Subscription) {
  return JSON.stringify([
    s.name.trim().toLowerCase(),
    s.currency,
    s.amountMinor,
    s.interval,
    s.intervalCount,
    s.customUnit,
    s.startDate,
    s.nextRenewal,
    s.status,
  ]);
}
export function uniqueCsvRows(rows: Subscription[], existing: Subscription[]) {
  const seen = new Set(existing.map(csvFingerprint));
  return rows.filter((s) => {
    const key = csvFingerprint(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
