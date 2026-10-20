import { Blocks, CreditCard, Landmark, WalletCards } from "lucide-react-native";
import { Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { paymentBrandPaths } from "../../assets/paymentBrandPaths";
import type { PaymentSource } from "../../domain/payments";
import { useTheme } from "../../theme/useTheme";

const networks: Readonly<Record<string, string>> = {
  Visa: "visa",
  Mastercard: "mastercard",
  "American Express": "americanexpress",
  Discover: "discover",
  JCB: "jcb",
  "Diners Club": "dinersclub",
};
type Identity = Pick<PaymentSource, "kind" | "cardBrand" | "walletProvider">;
// Native accessibility props are forwarded unchanged to <svg> on web.
const decorativeIconProps =
  Platform.OS === "web"
    ? ({ "aria-hidden": true, focusable: false } as const)
    : ({ accessible: false, accessibilityElementsHidden: true } as const);

export function PaymentMethodIcon({
  source,
  size = 26,
  color,
}: {
  source: Identity;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme(),
    ink = color || colors.text;
  const provider = source.walletProvider;
  const key =
    source.kind === "card" &&
    source.cardBrand &&
    Object.hasOwn(networks, source.cardBrand)
      ? networks[source.cardBrand]
      : source.kind === "wallet"
        ? provider === "Apple Wallet"
          ? "apple"
          : provider === "Google Wallet"
            ? "google"
            : provider === "PayPal"
              ? "paypal"
              : null
        : null;
  const path = key && paymentBrandPaths[key];
  if (path)
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        {...decorativeIconProps}
      >
        <Path d={path} fill={ink} />
      </Svg>
    );
  const Icon =
    source.kind === "bank"
      ? Landmark
      : source.kind === "card"
        ? CreditCard
        : provider === "Crypto wallet"
          ? Blocks
          : WalletCards;
  return (
    <Icon size={size} color={ink} strokeWidth={1.7} {...decorativeIconProps} />
  );
}

export function CardNetworkMark({
  source,
  color,
}: {
  source: Identity;
  color: string;
}) {
  const brand = source.cardBrand;
  const key = brand && Object.hasOwn(networks, brand) ? networks[brand] : null;
  const path = key && paymentBrandPaths[key];
  return path ? (
    <Svg width={64} height={38} viewBox="0 0 24 24" {...decorativeIconProps}>
      <Path d={path} fill={color} />
    </Svg>
  ) : (
    <CreditCard
      size={30}
      color={color}
      strokeWidth={1.5}
      {...decorativeIconProps}
    />
  );
}
