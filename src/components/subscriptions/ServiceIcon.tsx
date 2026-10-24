import { Text, View } from "react-native";
import { Dumbbell } from "lucide-react-native";
import Svg, { Path, SvgXml } from "react-native-svg";
import { serviceArtwork } from "../../assets/serviceArtwork";
import { serviceLogos } from "../../assets/serviceLogos";
import { serviceFor } from "../../domain/catalog";
import { tokens } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Bloom } from "../ui/Brand";
import { brandIdentity } from "../../brand/identity";
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
    glyph = service?.glyph,
    artwork =
      serviceId && Object.hasOwn(serviceArtwork, serviceId)
        ? serviceArtwork[serviceId]
        : undefined,
    logo =
      serviceId && Object.hasOwn(serviceLogos, serviceId)
        ? serviceLogos[serviceId]
        : undefined;
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
      {glyph === "subloom" ? (
        <Bloom size={size * 0.82} color={brandIdentity.colors.green} />
      ) : artwork ? (
        <SvgXml xml={artwork} width={size * 0.6} height={size * 0.65} />
      ) : logo ? (
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
          <Path d={logo} fill={color} />
        </Svg>
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
