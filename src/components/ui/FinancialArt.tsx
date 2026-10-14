import { Image } from "expo-image";

const illustrations = {
  wallet: require("../../../assets/illustrations/wallet-coins.webp"),
  renewals: require("../../../assets/illustrations/renewal-calendar.webp"),
};
export function FinancialArt({
  kind,
  size = 150,
}: {
  kind: keyof typeof illustrations;
  size?: number;
}) {
  return (
    <Image
      source={illustrations[kind]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
