import { Platform, Switch, type SwitchProps } from "react-native";
import { useTheme } from "../../theme/useTheme";

type Props = Omit<
  SwitchProps,
  "thumbColor" | "trackColor" | "ios_backgroundColor"
>;

export function ThemedSwitch({
  value = false,
  disabled,
  style,
  ...props
}: Props) {
  const { colors } = useTheme();
  // React Native Web colors the enabled thumb separately from thumbColor.
  const webProps =
    Platform.OS === "web" ? { activeThumbColor: colors.primary } : {};
  return (
    <Switch
      {...props}
      {...webProps}
      value={value}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor={value ? colors.primary : colors.surface}
      ios_backgroundColor={colors.border}
      style={[style, disabled && { opacity: 0.5 }]}
    />
  );
}
