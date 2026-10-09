import { Text, View } from "react-native";
import { Cloud, Dumbbell, Grid2X2, Sparkles } from "lucide-react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { serviceFor } from "../../domain/catalog";
import { tokens } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
export function ServiceIcon({
  serviceId,
  name,
  size = 44,
}: {
  serviceId: string | null;
  name: string;
  size?: number;
}) {
  const service = serviceFor(serviceId),
    { colors } = useTheme(),
    color = service?.color || colors.primary,
    glyph = service?.glyph;
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: service?.background || colors.mint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {glyph === "spotify" ? (
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="11" fill={color} />
          <Path
            d="M6 9C10 7.7 15 8 18 10M6.8 12C10.5 10.8 14.5 11.2 17.2 13M7.8 15C10.8 14.3 13.6 14.6 16 16"
            fill="none"
            stroke="#18251C"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </Svg>
      ) : glyph === "youtube" ? (
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
          <Rect x="1" y="5" width="22" height="15" rx="5" fill={color} />
          <Path d="M10 9L16 12.5L10 16Z" fill="#FFF" />
        </Svg>
      ) : glyph === "figma" ? (
        <Svg width={size * 0.55} height={size * 0.65} viewBox="0 0 20 30">
          <Rect x="0" y="0" width="20" height="10" rx="5" fill="#F24E1E" />
          <Circle cx="15" cy="5" r="5" fill="#FF7262" />
          <Rect x="0" y="10" width="10" height="10" rx="5" fill="#A259FF" />
          <Circle cx="15" cy="15" r="5" fill="#1ABCFE" />
          <Rect x="0" y="20" width="10" height="10" rx="5" fill="#0ACF83" />
        </Svg>
      ) : glyph === "cloud" ? (
        <Cloud color={color} size={size * 0.55} strokeWidth={2} />
      ) : glyph === "spark" ? (
        <Sparkles color={color} size={size * 0.5} />
      ) : glyph === "grid" ? (
        <Grid2X2 color={color} size={size * 0.5} />
      ) : glyph === "gym" ? (
        <Dumbbell color={color} size={size * 0.5} />
      ) : (
        <Text
          style={{
            fontSize: size * 0.52,
            fontFamily: tokens.fonts.displayBold,
            color,
          }}
        >
          {glyph || name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
