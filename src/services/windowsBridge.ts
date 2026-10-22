import { Platform } from "react-native";

type WindowsBridge = {
  version: number;
  openAuth: (url: string, redirect: string) => Promise<string>;
};
export function windowsBridge(): WindowsBridge | null {
  if (Platform.OS !== "web") return null;
  const bridge = (
    globalThis as typeof globalThis & { subloomWindows?: WindowsBridge }
  ).subloomWindows;
  return bridge?.version === 1 && typeof bridge.openAuth === "function"
    ? bridge
    : null;
}
