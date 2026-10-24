import { View } from "react-native";
import { Crown } from "lucide-react-native";
import { Label } from "../ui/Primitives";
import { useTheme } from "../../theme/useTheme";

export function ProFeatureBadge() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Subloom Pro feature"
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.mint,
      }}
    >
      <Crown size={12} color={colors.primary} />
      <Label size={11} bold color={colors.primary}>
        Pro
      </Label>
    </View>
  );
}
