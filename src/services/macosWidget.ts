import { create } from "zustand";
import { randomUUID } from "expo-crypto";
import { macWidgetPayload } from "../domain/macWidget";
import { today } from "../domain/renewal";
import { useApp, readableError } from "../store/app";
import { macosBridge, macosRequest } from "./macosBridge";

export const useMacWidget = create<{
  available: boolean;
  updated: boolean;
  error: string | null;
}>(() => ({ available: false, updated: false, error: null }));
let revision = 0;
let signature: unknown[] | null = null;

export async function refreshMacWidget(force = false) {
  if (!macosBridge()) return;
  const generation = ++revision;
  const state = useApp.getState();
  const current = () =>
    generation === revision && useApp.getState().identity === state.identity;
  try {
    if (!state.hydrated) {
      signature = null;
      await macosRequest("widget.clear");
      if (current()) useMacWidget.setState({ updated: false });
      return;
    }
    const nextSignature = [
      state.identity,
      state.data.subscriptions,
      state.data.preferences.timezone,
      state.data.preferences.privacyMode,
      state.data.onboarded,
      state.data.demo,
      today(state.data.preferences.timezone),
    ];
    if (!force && signature?.every((value, i) => value === nextSignature[i]))
      return;
    const session = randomUUID();
    const { available } = await macosRequest<{ available: boolean }>(
      "widget.activate",
      {
        identity: state.identity,
        session,
        isPrivate: state.data.preferences.privacyMode,
      },
    );
    if (!current() || !useApp.getState().hydrated) return;
    useMacWidget.setState({ available, error: null, updated: false });
    if (!available) return;
    await macosRequest("widget.publish", {
      identity: state.identity,
      session,
      value: JSON.stringify(macWidgetPayload(state.data, state.identity)),
    });
    if (!current() || !useApp.getState().hydrated) return;
    signature = nextSignature;
    useMacWidget.setState({ updated: true, error: null });
  } catch (error) {
    if (current())
      useMacWidget.setState({ updated: false, error: readableError(error) });
  }
}

export function maintainMacWidget() {
  if (!macosBridge()) return () => {};
  const refresh = () => void refreshMacWidget();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const remove = useApp.subscribe((state, previous) => {
    if (
      state.identity !== previous.identity ||
      state.hydrated !== previous.hydrated ||
      state.data.preferences.privacyMode !==
        previous.data.preferences.privacyMode
    ) {
      clearTimeout(timer);
      signature = null;
      refresh();
    } else if (state.data !== previous.data) {
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    }
  });
  const visibility = () => {
    if (document.visibilityState === "visible") refresh();
  };
  const interval = setInterval(refresh, 5 * 60_000);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", visibility);
  refresh();
  return () => {
    ++revision;
    clearTimeout(timer);
    clearInterval(interval);
    remove();
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", visibility);
  };
}
