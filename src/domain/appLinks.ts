export const APP_WEB_URL = "https://subloom.baltii.tn";

/** Email links can only navigate to known, non-mutating application screens. */
export function notificationPath(value: unknown): string | null {
  return typeof value === "string" &&
    /^\/(?:subscription\/[0-9a-f-]{36}|detection\/[0-9a-f-]{36}|settings)?$/i.test(
      value,
    )
    ? value
    : null;
}

export function appWebBase(value?: string): string {
  try {
    const url = new URL(value || APP_WEB_URL);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.origin;
  } catch {
    /* Legacy custom-scheme settings must not break email buttons. */
  }
  return APP_WEB_URL;
}

export function notificationWebUrl(path: string, base?: string): string {
  return `${appWebBase(base)}/open?path=${encodeURIComponent(notificationPath(path) ?? "/")}`;
}

export function notificationAppUrl(path: string): string {
  return `subloom://open?path=${encodeURIComponent(notificationPath(path) ?? "/")}`;
}
