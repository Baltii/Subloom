import { describe, it, expect } from "vitest";
import {
  parseStatement,
  statementExample,
  statementHeaders,
  defaultMapping,
  mergeStatement,
  recurringStreams,
  suggestSubscriptions,
  type PaymentTransaction,
} from "../../src/domain/radar";
import { subscription } from "../fixtures";
const mapping = defaultMapping(statementHeaders(statementExample));
function transaction(
  date: string,
  id: string,
  extra: Partial<PaymentTransaction> = {},
): PaymentTransaction {
  return {
    id,
    fingerprint: id.replace(/-/g, "").padEnd(64, "0"),
    date,
    merchant: "GitHub",
    amountMinor: 1234,
    currency: "USD",
    direction: "debit",
    sourceId: null,
    reference: "",
    subscriptionId: null,
    ignored: false,
    importedAt: "2026-10-12T12:00:00Z",
    ...extra,
  };
}
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
describe("statement radar", () => {
  it("requires explicit sign convention and exact currency minor units", () => {
    const rows = parseStatement(statementExample, mapping, "USD", true, null);
    expect(rows[0]?.direction).toBe("debit");
    expect(
      parseStatement(statementExample, mapping, "USD", false, null)[0]
        ?.direction,
    ).toBe("credit");
    expect(
      parseStatement(
        "Date,Merchant,Amount,Currency\n2026-10-12,Music,-1.234,TND",
        { ...mapping, reference: null },
        "USD",
        true,
        null,
      )[0]?.amountMinor,
    ).toBe(1234);
  });
  it("rejects invalid dates, ambiguous decimal amounts, duplicate headers and full card data", () => {
    for (const row of [
      "2026-02-30,Music,-1.23,USD",
      "2026-10-12,Music,-1.234,USD",
      "2026-10-12,4242424242424242,-1.23,USD",
    ])
      expect(() =>
        parseStatement(
          "Date,Merchant,Amount,Currency\n" + row,
          { ...mapping, reference: null },
          "USD",
          true,
          null,
        ),
      ).toThrow();
    expect(() =>
      statementHeaders("Date,Date,Amount\n2026-10-12,Music,1"),
    ).toThrow();
  });
  it("skips exact repeats while retaining different references and mixed currencies", () => {
    const t = transaction("2026-10-12", id);
    expect(mergeStatement([t], [t]).added).toBe(0);
    expect(
      mergeStatement(
        [t],
        [
          transaction("2026-10-12", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
            currency: "TND",
          }),
        ],
      ).value,
    ).toHaveLength(2);
  });
  it("requires three distinct dates and separates refunds, sources and currencies", () => {
    const rows = [
      transaction("2026-07-20", id),
      transaction("2026-08-20", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      transaction("2026-09-20", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
        amountMinor: 1499,
      }),
    ];
    expect(recurringStreams(rows)[0]).toMatchObject({
      interval: "monthly",
      changeMinor: 265,
    });
    expect(recurringStreams(rows.slice(0, 2))).toEqual([]);
    expect(
      recurringStreams(
        rows.map((r, i) => (i === 2 ? { ...r, direction: "credit" } : r)),
      ),
    ).toEqual([]);
    expect(
      recurringStreams(
        rows.map((r, i) => (i === 2 ? { ...r, currency: "TND" } : r)),
      ),
    ).toEqual([]);
  });
  it("suggests only bounded merchant matches in the same currency", () => {
    const t = transaction("2026-10-12", id, { merchant: "PAYPAL SPOTIFY" });
    expect(suggestSubscriptions(t, [subscription()])).toHaveLength(1);
    expect(
      suggestSubscriptions({ ...t, merchant: "Spotifyish" }, [subscription()]),
    ).toEqual([]);
    expect(
      suggestSubscriptions({ ...t, currency: "TND" }, [subscription()]),
    ).toEqual([]);
  });
});
