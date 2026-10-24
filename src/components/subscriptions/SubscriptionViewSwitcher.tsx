import { Pressable, View } from "react-native";
import { CalendarRange, List } from "lucide-react-native";
import { useTheme } from "../../theme/useTheme";

export function SubscriptionViewSwitcher({
  timeline,
  onChange,
}: {
  timeline: boolean;
  onChange: (timeline: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Subscription view"
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        backgroundColor: colors.mint,
        flexShrink: 0,
      }}
    >
      {[
        { icon: List, label: "List view", value: false },
        { icon: CalendarRange, label: "Timeline view", value: true },
      ].map(({ icon: Icon, label, value }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: timeline === value }}
          aria-pressed={timeline === value}
          onPress={() => onChange(value)}
          style={({ pressed }) => ({
            minWidth: 48,
            minHeight: 48,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              timeline === value ? colors.surface : "transparent",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon
            size={20}
            color={timeline === value ? colors.primary : colors.secondary}
            strokeWidth={1.8}
            aria-hidden
          />
        </Pressable>
      ))}
    </View>
  );
}
