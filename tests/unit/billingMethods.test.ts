import { describe, expect, it } from "vitest";
import { subscription } from "../fixtures";
import {
  paymentProfileSchema,
  paymentSourceSchema,
  removePaymentSource,
} from "../../src/domain/payments";
import {
  billingMethodDraftSchema,
  billingMethodLabel,
  billingReference,
  billingSourceId,
  buildBillingMethod,
  matchesBillingFilter,
  subscriptionBillingLabel,
  subscriptionBillingValue,
  unassignedBillingMethod,
} from "../../src/domain/billingMethods";

const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = "2026-10-19T20:00:00Z";
const draft = {
  kind: "card" as const,
  cardBrand: "Visa" as const,
  walletProvider: "PayPal" as const,
  last4: "0042",
  nickname: "Everyday",
};
const card = buildBillingMethod(draft, id, now);
const wallet = buildBillingMethod(
  { ...draft, kind: "wallet", nickname: "", last4: "" },
  otherId,
  now,
);
const profile = { sources: [card, wallet], links: [] };
describe("billing methods", () => {
  it("requires exactly four card digits without truncating full numbers or losing leading zeros", () => {
    expect(card.last4).toBe("0042");
    expect(billingMethodLabel(card)).toBe("Everyday · Visa •••• 0042");
    for (const last4 of [
      "",
      "123",
      "12345",
      "4242424242424242",
      "12a4",
      " 0042",
    ])
      expect(
        billingMethodDraftSchema.safeParse({ ...draft, last4 }).success,
      ).toBe(false);
    expect(
      billingMethodDraftSchema.safeParse({
        ...draft,
        nickname: "4242 4242 4242 4242",
      }).success,
    ).toBe(false);
    expect(paymentSourceSchema.safeParse({ ...card, cvv: "123" }).success).toBe(
      false,
    );
  });
  it("stores wallet labels without card details and rejects mismatched provider types", () => {
    expect(wallet).toMatchObject({
      kind: "wallet",
      name: "PayPal",
      walletProvider: "PayPal",
      cardBrand: null,
      last4: null,
      expiryMonth: null,
      expiryYear: null,
    });
    expect(billingMethodLabel(wallet)).toBe("PayPal");
    expect(
      paymentSourceSchema.safeParse({ ...wallet, cardBrand: "Visa" }).success,
    ).toBe(false);
    expect(
      paymentSourceSchema.safeParse({ ...card, walletProvider: "PayPal" })
        .success,
    ).toBe(false);
  });
  it("assigns by stable ID, even for cards with the same type and last four digits", () => {
    const secondCard = { ...card, id: otherId, name: "Shared" };
    const methods = { sources: [card, secondCard], links: [] };
    const item = subscription({ paymentMethod: billingReference(otherId) });
    expect(matchesBillingFilter(item, methods, billingReference(id))).toBe(
      false,
    );
    expect(matchesBillingFilter(item, methods, billingReference(otherId))).toBe(
      true,
    );
    expect(subscriptionBillingLabel(item, methods)).toBe(
      "Shared · Visa •••• 0042",
    );
    const edited = buildBillingMethod(
      { ...draft, cardBrand: "Mastercard", last4: "5678", nickname: "Travel" },
      otherId,
      now,
    );
    expect(
      subscriptionBillingLabel(item, { ...methods, sources: [card, edited] }),
    ).toBe("Travel · Mastercard •••• 5678");
  });
  it("filters card, wallet, exact method and unassigned subscriptions without guessing from notes", () => {
    const items = [
      billingReference(id),
      billingReference(otherId),
      unassignedBillingMethod,
      "Visa 0042",
    ].map((paymentMethod) => subscription({ paymentMethod }));
    expect(
      items.filter((item) => matchesBillingFilter(item, profile, "cards")),
    ).toEqual([items[0]]);
    expect(
      items.filter((item) => matchesBillingFilter(item, profile, "wallets")),
    ).toEqual([items[1]]);
    expect(
      items.filter((item) => matchesBillingFilter(item, profile, "unassigned")),
    ).toEqual(items.slice(2));
    expect(
      items.every((item) => matchesBillingFilter(item, profile, "all")),
    ).toBe(true);
    expect(billingSourceId("Visa 0042")).toBeNull();
  });
  it("preserves old records, billing notes and links while allowing explicit reassignment or clearing", () => {
    const legacy = {
      sources: [card],
      links: [
        { subscriptionId: subscription().id, sourceId: id, reviewedAt: now },
      ],
    };
    expect(
      paymentProfileSchema.safeParse({
        sources: [
          {
            id,
            kind: "card",
            name: "Old card",
            last4: null,
            expiryMonth: null,
            expiryYear: null,
            updatedAt: now,
          },
        ],
        links: [],
      }).success,
    ).toBe(true);
    expect(
      subscriptionBillingValue(subscription({ paymentMethod: "" }), legacy),
    ).toBe(billingReference(id));
    expect(
      subscriptionBillingLabel(
        subscription({ paymentMethod: "Old billing note" }),
        legacy,
      ),
    ).toBe("Old billing note");
    expect(
      subscriptionBillingLabel(
        subscription({ paymentMethod: unassignedBillingMethod }),
        legacy,
      ),
    ).toBe("Not assigned");
    expect(
      subscriptionBillingLabel(
        subscription({ paymentMethod: billingReference(otherId) }),
        { ...legacy, sources: [card, wallet] },
      ),
    ).toBe("PayPal");
  });
  it("never silently moves a removed method to another card, and retains the 50-method limit", () => {
    const item = subscription({ paymentMethod: billingReference(id) });
    expect(
      subscriptionBillingLabel(item, removePaymentSource(profile, id)),
    ).toBe("Billing method unavailable");
    expect(
      matchesBillingFilter(item, removePaymentSource(profile, id), "cards"),
    ).toBe(false);
    expect(
      matchesBillingFilter(
        item,
        removePaymentSource(profile, id),
        "unassigned",
      ),
    ).toBe(true);
    expect(
      paymentProfileSchema.safeParse({
        sources: Array.from({ length: 51 }, (_, i) => ({
          ...card,
          id: "00000000-0000-4000-8000-" + String(i).padStart(12, "0"),
        })),
        links: [],
      }).success,
    ).toBe(false);
  });
});
