import { notificationPath } from "../domain/appLinks";

let pending: string | null = null;
const key = "subloom.notification-path";
export function rememberNotificationPath(path: string) {
  pending = notificationPath(path);
  try {
    sessionStorage.setItem(key, pending || "/");
  } catch {
    /* Native or storage disabled. */
  }
}
export function pendingNotificationPath() {
  try {
    return notificationPath(sessionStorage.getItem(key)) ?? pending;
  } catch {
    return pending;
  }
}
export function clearNotificationPath() {
  pending = null;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Native or storage disabled. */
  }
}
