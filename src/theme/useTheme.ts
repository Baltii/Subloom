import { useColorScheme, useWindowDimensions } from "react-native";
import { useApp } from "../store/app";
import { dark, light } from "./tokens";
export function useTheme() {
  const system = useColorScheme(),
    appearance = useApp((s) => s.data.preferences.appearance);
  const isDark =
    appearance === "dark" || (appearance === "system" && system === "dark");
  return { colors: isDark ? dark : light, isDark };
}
export function useWide() {
  return useWindowDimensions().width >= 900;
}
