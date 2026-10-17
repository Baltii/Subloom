import { create } from "zustand";
import { localReminderPlan } from "../domain/localReminders";
import { today } from "../domain/renewal";
import { useApp, readableError, notify } from "../store/app";
import { safeNotificationPath } from "./notifications";
import { macosBridge, macosRequest } from "./macosBridge";

type Status = {
  enabled: boolean;
  permission: "granted" | "denied" | "notDetermined";
  pending: number;
  alertsEnabled: boolean;
  testDelivered: boolean;
};
export const useMacNotifications = create<Status & { error: string | null }>(
  () => ({
    enabled: false,
    permission: "notDetermined",
    pending: 0,
    alertsEnabled: true,
    testDelivered: false,
    error: null,
  }),
);
let work: Promise<unknown> = Promise.resolve();
let signature: string | null = null;
let active = false;
export function refreshMacReminders(): Promise<void> {
  if (!macosBridge()) return Promise.resolve();
  const task = work.then(async () => {
    const state = useApp.getState();
    if (!state.hydrated) {
      signature = null;
      useMacNotifications.setState({
        enabled: false,
        pending: 0,
        testDelivered: false,
      });
      if (active) await macosRequest("notification.clear");
      active = false;
      return;
    }
    const identity = state.identity;
    let status = await macosRequest<Status>("notification.activate", {
      identity,
    });
    active = true;
    if (useApp.getState().identity !== identity || !useApp.getState().hydrated)
      return;
    const data = useApp.getState().data;
    const nextSignature = JSON.stringify([
      identity,
      status.enabled,
      status.permission,
      data.demo,
      data.onboarded,
      data.subscriptions,
      data.preferences,
      today(data.preferences.timezone),
    ]);
    if (signature !== nextSignature) {
      status = await macosRequest<Status>("notification.replace", {
        identity,
        requests:
          status.enabled && status.permission === "granted"
            ? localReminderPlan(data)
            : [],
      });
      signature = nextSignature;
    }
    if (useApp.getState().identity === identity && useApp.getState().hydrated)
      useMacNotifications.setState({ ...status, error: null });
  });
  work = task.catch(() => {});
  return task.catch((error) => {
    useMacNotifications.setState({ error: readableError(error) });
    throw error;
  });
}
export async function enableMacReminders(enabled: boolean) {
  await refreshMacReminders();
  const identity = useApp.getState().identity;
  const status = await macosRequest<Status>("notification.enable", {
    identity,
    enabled,
  });
  if (identity !== useApp.getState().identity || !useApp.getState().hydrated)
    throw new Error("Your workspace changed. Retry in the current workspace.");
  useMacNotifications.setState(status);
  signature = null;
  await refreshMacReminders();
}
export async function sendMacTestNotification() {
  await refreshMacReminders();
  const identity = useApp.getState().identity;
  await macosRequest("notification.test", {
    identity,
  });
  useMacNotifications.setState({ testDelivered: false });
  setTimeout(() => {
    if (useApp.getState().identity === identity)
      void refreshMacReminders().catch(() => {});
  }, 8_000);
}
export function openMacNotificationSettings() {
  return macosRequest<void>("notification.settings");
}
export function maintainMacReminders(navigate: (path: string) => void) {
  if (!macosBridge()) return () => {};
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (!disposed) void refreshMacReminders().catch(() => {});
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 250);
  };
  const remove = useApp.subscribe((state, previous) => {
    if (
      state.identity !== previous.identity ||
      state.hydrated !== previous.hydrated
    ) {
      clearTimeout(timer);
      signature = null;
      refresh();
    } else if (state.data !== previous.data) schedule();
  });
  const navigation = async () => {
    if (disposed || !useApp.getState().hydrated) return;
    const response = await macosRequest<{
      identity: string;
      path: string;
    } | null>("notification.navigation");
    if (disposed || !response) return;
    const path = safeNotificationPath(response.path);
    if (path && response.identity === useApp.getState().identity)
      navigate(path);
    else if (path)
      notify(
        "This item belongs to another workspace. Open that account to view it.",
      );
  };
  const handleNavigation = () => {
    void navigation().catch(() => {});
  };
  const visibility = () => {
    if (document.visibilityState === "visible") refresh();
  };
  window.addEventListener("focus", refresh);
  window.addEventListener("subloom-notification", handleNavigation);
  document.addEventListener("visibilitychange", visibility);
  const interval = setInterval(refresh, 5 * 60_000);
  refresh();
  const hydrateNavigation = useApp.subscribe((state) => {
    if (state.hydrated) handleNavigation();
  });
  handleNavigation();
  return () => {
    disposed = true;
    remove();
    hydrateNavigation();
    clearTimeout(timer);
    clearInterval(interval);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("subloom-notification", handleNavigation);
    document.removeEventListener("visibilitychange", visibility);
  };
}
