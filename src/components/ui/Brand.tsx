import Svg, { Path, G } from "react-native-svg";
import { useTheme } from "../../theme/useTheme";
import { brandIdentity } from "../../brand/identity";

export function Bloom({ size = 34, color }: { size?: number; color?: string }) {
  const { isDark } = useTheme();
  const fill =
    color || (isDark ? brandIdentity.colors.mint : brandIdentity.colors.green);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityRole="image"
      accessibilityLabel="Subloom"
    >
      <Path d={brandIdentity.markPath} fill={fill} />
    </Svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  const { isDark } = useTheme();
  const markColor = isDark
    ? brandIdentity.colors.mint
    : brandIdentity.colors.green;
  const textColor = isDark
    ? brandIdentity.colors.mint
    : brandIdentity.colors.forest;
  if (compact) return <Bloom size={32} />;
  return (
    <Svg
      width={brandIdentity.lockupWidth / 2}
      height={32}
      viewBox={`0 0 ${brandIdentity.lockupWidth} 64`}
      accessibilityRole="image"
      accessibilityLabel="Subloom"
    >
      <Path d={brandIdentity.markPath} fill={markColor} />
      <Path
        d={brandIdentity.wordmarkPath}
        transform={`translate(${brandIdentity.wordmarkOffsetX} 0)`}
        fill={textColor}
      />
    </Svg>
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
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <G fill={color}>
        <Path d={brandIdentity.markPath} />
      </G>
    </Svg>
  );
}
