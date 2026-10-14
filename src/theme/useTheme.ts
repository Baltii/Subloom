import { useColorScheme, useWindowDimensions } from "react-native";
import { useApp } from "../store/app";
import { getThemeColors } from "./palettes";
export function useTheme() {
  const system = useColorScheme(),
    appearance = useApp((s) => s.data.preferences.appearance),
    accentTheme = useApp((s) => s.data.preferences.accentTheme);
  const isDark =
    appearance === "dark" || (appearance === "system" && system === "dark");
  return { colors: getThemeColors(accentTheme, isDark), isDark, accentTheme };
}
export function useWide() {
  return useWindowDimensions().width >= 900;
}
