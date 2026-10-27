import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { lockStorageKey } from "../domain/appLock";
import { macosBridge, macosRequest } from "./macosBridge";
import { windowsBridge } from "./windowsBridge";

// Kept outside snapshots, account sync, exports and guest-data resets.
export const lockStorage = {
  async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (Platform.OS !== "web" || macosBridge() || windowsBridge())
      return action();
    if (typeof navigator === "undefined" || !navigator.locks?.request)
      throw new Error(
        "Use an updated secure browser to manage app protection.",
      );
    return navigator.locks.request(lockStorageKey, action);
  },
  async read(): Promise<string | null> {
    if (macosBridge()) return macosRequest("security.read");
    const windows = windowsBridge();
    if (windows) {
      if (!windows.security)
        throw new Error("Update the Windows app to use app protection.");
      return windows.security.read();
    }
    if (Platform.OS === "web")
      return globalThis.localStorage.getItem(lockStorageKey);
    return SecureStore.getItemAsync(lockStorageKey);
  },
  async write(value: string): Promise<void> {
    if (macosBridge()) {
      await macosRequest("security.write", { value });
      return;
    }
    const windows = windowsBridge();
    if (windows) {
      if (!windows.security)
        throw new Error("Update the Windows app to use app protection.");
      await windows.security.write(value);
      return;
    }
    if (Platform.OS === "web") {
      globalThis.localStorage.setItem(lockStorageKey, value);
      return;
    }
    await SecureStore.setItemAsync(lockStorageKey, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
