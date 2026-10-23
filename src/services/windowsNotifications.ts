import { create } from "zustand";
import { windowsBridge } from "./windowsBridge";
import { localReminderPlan } from "../domain/localReminders";
import { useApp, readableError } from "../store/app";
import { safeNotificationPath } from "./notifications";

export type WindowsNotificationStatus = {
  supported: boolean;
  enabled: boolean;
  pending: number;
};
export const useWindowsNotifications = create<
  WindowsNotificationStatus & { error: string | null }
>(() => ({
  supported: false,
  enabled: false,
  pending: 0,
  error: null,
}));
let work: Promise<unknown> = Promise.resolve();
function bridge() {
  const notifications = windowsBridge()?.notifications;
  if (!notifications)
    throw new Error("Update the Windows app to enable system notifications.");
  return notifications;
}
export function refreshWindowsReminders() {
  if (!windowsBridge()?.notifications) return Promise.resolve();
  const task = work.then(async () => {
    const state = useApp.getState();
    const identity = state.hydrated ? state.identity : null;
    let status = await bridge().activate(identity);
    if (
      identity &&
      useApp.getState().identity === identity &&
      useApp.getState().hydrated
    ) {
      status = await bridge().replace(
        identity,
        status.enabled ? localReminderPlan(useApp.getState().data) : [],
      );
    }
    if (
      (useApp.getState().hydrated ? useApp.getState().identity : null) ===
      identity
    )
      useWindowsNotifications.setState({ ...status, error: null });
  });
  work = task.catch(() => {});
  return task.catch((error) => {
    useWindowsNotifications.setState({ error: readableError(error) });
    throw error;
  });
}
export async function enableWindowsReminders(enabled: boolean) {
  await refreshWindowsReminders();
  const identity = useApp.getState().identity;
  await bridge().enable(identity, enabled);
  await refreshWindowsReminders();
}
export async function sendWindowsTestNotification() {
  await refreshWindowsReminders();
  await bridge().test(useApp.getState().identity);
}
export async function openWindowsNotificationSettings() {
  await bridge().openSettings();
}
export function maintainWindowsReminders(navigate: (path: string) => void) {
  const notifications = windowsBridge()?.notifications;
  if (!notifications) return () => {};
  let timer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    void refreshWindowsReminders().catch(() => {});
  };
  const remove = useApp.subscribe((state, previous) => {
    if (
      state.identity !== previous.identity ||
      state.hydrated !== previous.hydrated
    ) {
      clearTimeout(timer);
      // Invalidate pending timers and visible alerts immediately, before queued work.
      void notifications.activate(null).catch(() => {});
      refresh();
    } else if (state.data !== previous.data) {
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    }
  });
  const navigation = notifications.onClick((response) => {
    const state = useApp.getState();
    const path = safeNotificationPath(response.path);
    if (path && state.hydrated && state.identity === response.identity)
      navigate(path);
  });
  const interval = setInterval(refresh, 5 * 60_000);
  window.addEventListener("focus", refresh);
  refresh();
  return () => {
    clearTimeout(timer);
    clearInterval(interval);
    remove();
    navigation();
    window.removeEventListener("focus", refresh);
    void notifications.activate(null).catch(() => {});
  };
}
