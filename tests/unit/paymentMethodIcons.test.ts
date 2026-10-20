import * as React from "react";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CardNetworkMark,
  PaymentMethodIcon,
} from "../../src/components/payments/PaymentMethodIcon";

const { renderToStaticMarkup } = createRequire(import.meta.url)(
  "react-dom/server",
) as { renderToStaticMarkup: (node: React.ReactNode) => string };

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../../src/theme/useTheme", () => ({
  useTheme: () => ({ colors: { text: "#18251C" } }),
}));
// Preserve every SVG prop at the DOM boundary, where React rejects native-only
// accessibility props. Native SVG/Lucide imports require a native runtime.
vi.mock("react-native-svg", () => ({ default: "svg", Path: "path" }));
vi.mock("lucide-react-native", () => ({
  Blocks: "svg",
  CreditCard: "svg",
  Landmark: "svg",
  WalletCards: "svg",
}));
vi.stubGlobal("React", React);
afterEach(() => vi.restoreAllMocks());

describe("billing icon web accessibility", () => {
  it.each([
    { kind: "card", cardBrand: "Visa" },
    { kind: "card", cardBrand: "UnionPay" },
    { kind: "wallet", walletProvider: "PayPal" },
    { kind: "wallet", walletProvider: "Crypto wallet" },
  ] as const)(
    "renders $kind $cardBrand $walletProvider without DOM warnings",
    (source) => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const markup = renderToStaticMarkup(
        React.createElement(PaymentMethodIcon, { source }),
      );
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
      expect(markup).not.toMatch(/accessible=|accessibilityElementsHidden=/);
      expect(errors).not.toHaveBeenCalled();
    },
  );

  it.each(["Visa", "UnionPay"] as const)(
    "renders the %s card-face mark without DOM warnings",
    (cardBrand) => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const markup = renderToStaticMarkup(
        React.createElement(CardNetworkMark, {
          source: { kind: "card", cardBrand },
          color: "#18251C",
        }),
      );
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
      expect(markup).not.toMatch(/accessible=|accessibilityElementsHidden=/);
      expect(errors).not.toHaveBeenCalled();
    },
  );
});
