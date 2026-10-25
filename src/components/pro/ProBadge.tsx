import { View } from "react-native";
import { Crown } from "lucide-react-native";
import { useProAccess } from "../../hooks/useProAccess";
import { useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
import { Label } from "../ui/Primitives";
import { PRO_PLAN_ENABLED } from "../../domain/planMode";

export function ProBadge() {
  const demo = useApp((s) => s.data.demo);
  const { pro: active } = useProAccess();
  const { colors } = useTheme();
  if (!PRO_PLAN_ENABLED || !active || demo) return null;
  return (
    <View
      accessibilityLabel="Subloom Pro member"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 3,
      }}
    >
      <Crown size={13} color={colors.primary} />
      <Label size={11} bold color={colors.primary}>
        Subloom Pro
      </Label>
    </View>
  );
}
