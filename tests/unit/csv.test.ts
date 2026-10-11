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
