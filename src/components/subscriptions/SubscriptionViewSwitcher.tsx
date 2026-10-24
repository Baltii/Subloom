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
        gap: 0,
        padding: 2,
        borderRadius: 12,
        backgroundColor: "transparent",
        borderColor: colors.border,
        borderWidth: 1,
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
            minWidth: 44,
            minHeight: 44,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              timeline === value ? colors.surface : "transparent",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon
            size={18}
            color={timeline === value ? colors.text : colors.secondary}
            strokeWidth={1.8}
            aria-hidden
          />
        </Pressable>
      ))}
    </View>
  );
}
