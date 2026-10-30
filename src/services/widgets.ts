import { AppState, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { hasAppLock } from "../domain/appLock";
import { today } from "../domain/renewal";
import { widgetSnapshot } from "../domain/widget";
import { useApp } from "../store/app";
import { appLock } from "./appLock";
import { macosBridge, macosRequest } from "./macosBridge";

export function maintainWidgets() {
  const native =
    Platform.OS === "android"
      ? requireOptionalNativeModule<{ replace(value: string): Promise<void> }>(
          "SubloomWidget",
        )
      : null;
  if (!native && !macosBridge()) return () => {};
  let work: Promise<unknown> = Promise.resolve();
  let signature = "";
  let disposed = false;
  let previousInput: unknown[] = [];
  const refresh = () => {
    if (disposed) return;
    const state = useApp.getState();
    const lock = appLock.state.getState();
    const protectedApp = !lock.ready || hasAppLock(lock.config);
    const input = [
      state.identity,
      state.hydrated,
      state.data.subscriptions,
      state.data.demo,
      state.data.onboarded,
      state.data.preferences.privacyMode,
      state.data.preferences.timezone,
      protectedApp,
      today(state.data.preferences.timezone),
    ];
    if (input.every((value, index) => Object.is(value, previousInput[index])))
      return;
    previousInput = input;
    let value: string;
    try {
      value = JSON.stringify(
        widgetSnapshot(state.hydrated ? state.data : null, protectedApp),
      );
    } catch {
      previousInput = [];
      return;
    }
    // Include workspace identity even if its visible content is identical.
    const next = `${state.identity}:${value}`;
    if (signature === next) return;
    signature = next;
    work = work
      .catch(() => {})
      .then(async () => {
        if (native) await native.replace(value);
        else await macosRequest("widget.replace", { value });
      })
      .catch(() => {
        if (signature === next) {
          signature = "";
          previousInput = [];
        }
      });
  };
  const removeApp = useApp.subscribe(refresh);
  const removeLock = appLock.state.subscribe(refresh);
  const listener = AppState.addEventListener("change", (state) => {
    if (state === "active") refresh();
  });
  if (Platform.OS === "web") window.addEventListener("focus", refresh);
  const timer = setInterval(refresh, 60_000);
  refresh();
  return () => {
    disposed = true;
    removeApp();
    removeLock();
    listener.remove();
    clearInterval(timer);
    if (Platform.OS === "web") window.removeEventListener("focus", refresh);
  };
}
