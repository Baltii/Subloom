import { createElement, type ReactNode } from "react";
import { createRequire } from "node:module";
import { beforeEach, expect, it, vi } from "vitest";
import { SubscriptionRow } from "../../src/components/subscriptions/SubscriptionRow";
import {
  convertedSubscriptions,
  type ExchangeRate,
} from "../../src/domain/exchangeRates";
import { subscription } from "../fixtures";
const { renderToStaticMarkup } = createRequire(import.meta.url)(
  "react-dom/server",
) as { renderToStaticMarkup: (node: ReactNode) => string };
const actions = vi.hoisted(() => ({ subscription: null as unknown }));
vi.mock("react-native", () => ({
  View: "div",
  Pressable: ({
    children,
    accessibilityLabel,
  }: {
    children: ReactNode;
    accessibilityLabel: string;
  }) => createElement("button", { "aria-label": accessibilityLabel }, children),
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("lucide-react-native", () => ({ ChevronRight: () => null }));
vi.mock("../../src/theme/useTheme", () => ({
  useTheme: () => ({ colors: {} }),
  useWide: () => true,
}));
vi.mock("../../src/components/ui/Primitives", () => ({
  Label: ({ children }: { children: ReactNode }) =>
    createElement("span", null, children),
  Badge: ({ children }: { children: ReactNode }) =>
    createElement("span", null, children),
}));
vi.mock("../../src/components/subscriptions/ServiceIcon", () => ({
  ServiceIcon: () => null,
}));
vi.mock("../../src/components/subscriptions/SubscriptionActions", () => ({
  SubscriptionActions: ({ subscription }: { subscription: unknown }) => {
    actions.subscription = subscription;
    return null;
  },
}));
beforeEach(() => {
  actions.subscription = null;
});
const rates: ExchangeRate[] = [
  {
    base_currency: "USD",
    quote_currency: "GBP",
    rate: "0.75",
    as_of: "2026-10-25",
    fetched_at: "2026-10-25T00:00:00Z",
    provider: "frankfurter",
  },
];
it("shows converted list prices while keeping original amounts in subscription actions", () => {
  const original = subscription({ amountMinor: 2000, currency: "USD" });
  const displayed = convertedSubscriptions([original], "GBP", rates)
    .subscriptions[0];
  const html = renderToStaticMarkup(
    createElement(SubscriptionRow, {
      subscription: original,
      reference: "2026-10-25",
      showActions: true,
      displayPrice: displayed,
    }),
  );
  expect(html).toContain("£15.00");
  expect(html).toContain("GBP / month");
  expect(html).toContain('aria-label="Spotify, £15.00 GBP per month');
  expect(html).not.toContain("$20.00");
  expect(actions.subscription).toBe(original);
  expect(original).toMatchObject({ currency: "USD", amountMinor: 2000 });
});
it("retains the original price when no converted estimate is available", () => {
  const original = subscription({ amountMinor: 2000, currency: "USD" });
  const html = renderToStaticMarkup(
    createElement(SubscriptionRow, {
      subscription: original,
      reference: "2026-10-25",
    }),
  );
  expect(html).toContain("$20.00");
  expect(html).toContain("USD / month");
});
it("shows an unavailable price instead of silently falling back to USD", () => {
  const html = renderToStaticMarkup(
    createElement(SubscriptionRow, {
      subscription: subscription({ amountMinor: 2000 }),
      reference: "2026-10-25",
      displayPrice: null,
    }),
  );
  expect(html).toContain("Rate unavailable");
  expect(html).not.toContain("$20.00");
});
