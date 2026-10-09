import { Text, View } from "react-native";
import Svg, { Path, Ellipse, G } from "react-native-svg";
import { useTheme } from "../../theme/useTheme";
import { tokens } from "../../theme/tokens";
export function Bloom({ size = 34, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      accessibilityLabel="Subloom flower"
    >
      <Path
        d="M24 24C2 25 5 4 16 8C22 10 24 16 24 24Z M24 24C23 2 44 5 40 16C38 22 32 24 24 24Z M24 24C46 23 43 44 32 40C26 38 24 32 24 24Z M24 24C25 46 4 43 8 32C10 26 16 24 24 24Z"
        fill={color || colors.primary}
      />
    </Svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Bloom size={32} />
      {!compact && (
        <Text
          style={{
            fontFamily: tokens.fonts.displayBold,
            fontSize: 23,
            color: colors.text,
            letterSpacing: -1,
          }}
        >
          subloom<Text style={{ color: colors.primary }}>.</Text>
        </Text>
      )}
    </View>
  );
}
export function BloomArt({
  size = 200,
  color = "#A4C694",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" aria-hidden>
      <G transform="translate(120 120)">
        {Array.from({ length: 8 }, (_, i) => (
          <Ellipse
            key={i}
            cx="0"
            cy="-51"
            rx="31"
            ry="58"
            fill={color}
            opacity={0.4 + i * 0.065}
            transform={"rotate(" + i * 45 + ")"}
          />
        ))}
      </G>
    </Svg>
  );
}
