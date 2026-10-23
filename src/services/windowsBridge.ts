import { Platform } from "react-native";
import type { LocalReminder } from "../domain/localReminders";

type NotificationStatus = {
  supported: boolean;
  enabled: boolean;
  pending: number;
};

type WindowsBridge = {
  version: number;
  openAuth: (url: string, redirect: string) => Promise<string>;
  cancelAuth?: () => Promise<void>;
  notifications?: {
    activate: (identity: string | null) => Promise<NotificationStatus>;
    enable: (identity: string, enabled: boolean) => Promise<NotificationStatus>;
    replace: (
      identity: string,
      requests: LocalReminder[],
    ) => Promise<NotificationStatus>;
    test: (identity: string) => Promise<void>;
    openSettings: () => Promise<void>;
    onClick: (
      listener: (response: { identity: string; path: string }) => void,
    ) => () => void;
  };
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
