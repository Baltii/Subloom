import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { subscription } from "../fixtures";
import {
  csvSubscriptions,
  parseCsv,
  exportCsv,
  uniqueCsvRows,
  csvExample,
} from "../../src/domain/csv";
it("round trips multiline, quoted and formula-looking values with monetary precision", () => {
  const s = subscription({
    name: '=HYPERLINK("x")',
    notes: "One, two\nThree",
    currency: "TND",
    amountMinor: 1099,
  });
  const csv = exportCsv([s]);
  expect(csv).toContain("'=HYPERLINK");
  expect(csvSubscriptions(csv, "guest", randomUUID)[0]).toMatchObject({
    name: s.name,
    notes: s.notes,
    currency: "TND",
    amountMinor: 1099,
    userId: "guest",
  });
});
it("validates dates, headers, row sizes and quotes", () => {
  expect(() => parseCsv('"unfinished')).toThrow(/Unclosed/);
  expect(() => parseCsv('"closed"oops')).toThrow(/Unexpected/);
  expect(() =>
    csvSubscriptions(
      csvExample.replace("2026-11-11", "2026-02-30"),
      "guest",
      randomUUID,
    ),
  ).toThrow(/row 2/);
  expect(() => csvSubscriptions("name,name\nx,y", "guest", randomUUID)).toThrow(
    /unique/,
  );
  expect(() => parseCsv("x".repeat(2_000_001))).toThrow(/2 MB/);
});
it("skips identical records without overwriting", () => {
  const s = subscription();
  expect(uniqueCsvRows([s, s], [s])).toEqual([]);
  expect(uniqueCsvRows([s, s], [])).toEqual([s]);
  expect(parseCsv('\uFEFFa,b\r\n"a,b","d""e"')).toEqual([
    ["a", "b"],
    ["a,b", 'd"e'],
  ]);
});
it("rejects a trial without an end date before any records can be imported", () => {
  const input =
    csvExample.replace("nextRenewal\r\n", "nextRenewal,status\r\n") + ",trial";
  expect(() => csvSubscriptions(input, "guest", randomUUID)).toThrow(
    "CSV row 2: trialEnd: Trial subscriptions require a trialEnd date.",
  );
});
it("round trips every supported currency and preserves schedule/status metadata", async () => {
  const { currencies } = await import("../../src/domain/models");
  const originals = currencies.map((currency, index) =>
    subscription({
      id: randomUUID(),
      name: `CSV ${currency}`,
      currency,
      amountMinor: 12345,
      interval: "custom",
      intervalCount: 6,
      customUnit: "week",
      anchorDay: 31,
      status: index % 2 ? "paused" : "canceled",
      canceledAt: index % 2 ? null : "2026-10-20",
      paidThrough: index % 2 ? null : "2026-11-20",
      paymentMethod: "Visa ending 1234",
      notes: 'Quoted "plan", notes\nSecond line — أداة',
    }),
  );
  const restored = csvSubscriptions(exportCsv(originals), "guest", randomUUID);
  expect(restored).toHaveLength(currencies.length);
  originals.forEach((original, index) => {
    const {
      id: _id,
      userId: _owner,
      serviceId: _service,
      createdAt: _created,
      updatedAt: _updated,
      ...fields
    } = original;
    expect(restored[index]).toMatchObject(fields);
  });
});
it("accepts 500 rows and rejects 501, invalid amounts, unsupported currencies and column mismatches", () => {
  const rows = Array.from({ length: 500 }, (_, index) =>
    subscription({ id: randomUUID(), name: `CSV service ${index}` }),
  );
  expect(csvSubscriptions(exportCsv(rows), "guest", randomUUID)).toHaveLength(
    500,
  );
  expect(() =>
    csvSubscriptions(exportCsv([...rows, subscription()]), "guest", randomUUID),
  ).toThrow(/500/);
  for (const input of [
    csvExample.replace("10.99", "-10.99"),
    csvExample.replace("USD", "ZZZ"),
    csvExample.replace("10.99", "10.999"),
    csvExample + ",extra",
  ])
    expect(() => csvSubscriptions(input, "guest", randomUUID)).toThrow(/row 2/);
});
