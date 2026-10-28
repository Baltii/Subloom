import { View } from "react-native";
import { InteractiveSurface } from "./InteractiveSurface";
import { Check, Monitor, Moon, Sun } from "lucide-react-native";
import type { AccentTheme, Preferences } from "../../domain/models";
import { accentThemes } from "../../theme/palettes";
import { useTheme, useWide } from "../../theme/useTheme";
import { useApp } from "../../store/app";
import { Label } from "./Primitives";

export function ThemePicker({
  compact = false,
  disabled,
  onAccent,
  onAppearance,
}: {
  compact?: boolean;
  disabled: boolean;
  onAccent: (accent: AccentTheme) => void;
  onAppearance: (appearance: Preferences["appearance"]) => void;
}) {
  const { colors, accentTheme } = useTheme();
  const wide = useWide();
  return (
    <View style={{ gap: 20 }}>
      <Label bold size={13}>
        Accent color
      </Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {accentThemes.map(({ id, name, swatch }) => {
          const selected = accentTheme === id;
          return (
            <InteractiveSurface
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${name} theme`}
              accessibilityState={{ selected, disabled }}
              aria-pressed={selected}
              disabled={disabled}
              onPress={() => onAccent(id)}
              style={({ pressed, hovered }) => ({
                width: wide && !compact ? "22%" : "46%",
                flexGrow: 1,
                minHeight: 76,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor:
                  selected || pressed || hovered
                    ? colors.mint
                    : colors.background,
                opacity: disabled ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: swatch,
                  borderWidth: 1,
                  borderColor: colors.secondary,
                  overflow: "hidden",
                }}
              >
                {id === "mono" ? (
                  <View
                    style={{
                      width: "50%",
                      height: "100%",
                      alignSelf: "flex-end",
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                ) : null}
              </View>
              <Label size={13} bold={selected} style={{ flex: 1 }}>
                {name}
              </Label>
              {selected ? <Check size={16} color={colors.primary} /> : null}
            </InteractiveSurface>
          );
        })}
      </View>
      <AppearancePicker disabled={disabled} onChange={onAppearance} />
    </View>
  );
}

function AppearancePicker({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (appearance: Preferences["appearance"]) => void;
}) {
  const { colors } = useTheme();
  const appearance = useApp((s) => s.data.preferences.appearance);
  return (
    <View style={{ gap: 10 }}>
      <Label bold size={13}>
        Appearance
      </Label>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {(
          [
            { id: "system", name: "System", icon: Monitor },
            { id: "light", name: "Light", icon: Sun },
            { id: "dark", name: "Dark", icon: Moon },
          ] as const
        ).map(({ id, name, icon: Icon }) => (
          <InteractiveSurface
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`${name} appearance`}
            accessibilityState={{ selected: appearance === id, disabled }}
            aria-pressed={appearance === id}
            disabled={disabled}
            onPress={() => onChange(id)}
            style={({ pressed, hovered }) => ({
              flexGrow: 1,
              minHeight: 56,
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              borderWidth: 1,
              opacity: disabled ? 0.6 : 1,
              borderColor: appearance === id ? colors.primary : colors.border,
              backgroundColor:
                appearance === id || pressed || hovered
                  ? colors.mint
                  : colors.surface,
            })}
          >
            <Icon
              size={18}
              color={appearance === id ? colors.primary : colors.secondary}
            />
            <Label size={13} bold={appearance === id}>
              {name}
            </Label>
          </InteractiveSurface>
        ))}
      </View>
    </View>
  );
}
