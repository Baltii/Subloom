const path = require("node:path");
const { statSync } = require("node:fs");
const APP_URL = "subloom-app://bundle/";
function isAppURL(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "subloom-app:" &&
      url.host === "bundle" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function externalURL(value) {
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function bundledFile(value, root) {
  if (!isAppURL(value)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(value).pathname);
  } catch {
    return null;
  }
  if (
    /[\\\x00]/.test(pathname) ||
    pathname.split("/").some((p) => p.startsWith("."))
  )
    return null;
  const base = path.resolve(root);
  const target = path.resolve(base, "." + pathname);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  try {
    if (statSync(target).isFile()) return target;
  } catch {}
  // Expo's single-page export uses the same HTML for client-side routes.
  if (!path.extname(pathname)) return path.join(base, "index.html");
  return null;
}
function callbackMatches(value, redirect) {
  try {
    const actual = new URL(value),
      expected = new URL(redirect);
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      (actual.pathname === expected.pathname ||
        (actual.protocol === "subloom:" &&
          actual.pathname === "/" &&
          expected.pathname === "")) &&
      !actual.username &&
      !actual.password
    );
  } catch {
    return false;
  }
}
function createAuthBroker(openExternal, timeoutMs = 180000) {
  let pending = null;
  return {
    open(url, redirect) {
      const target = externalURL(url);
      if (
        !target ||
        !["subloom://auth-callback", "subloom://mailboxes"].includes(redirect)
      )
        return Promise.reject(
          new Error("This sign-in address is not supported."),
        );
      if (pending)
        return Promise.reject(new Error("A sign-in is already in progress."));
      const browserURL = new URL(target);
      // The Windows shell owns its return address. A missing/stale web return
      // on a Supabase OAuth URL otherwise silently signs into the website.
      if (browserURL.pathname === "/auth/v1/authorize")
        browserURL.searchParams.set("redirect_to", redirect);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            this.cancel(
              "Sign-in timed out without returning to Subloom. If your browser opened the website, the app callback is not configured correctly. Try an email code or restart sign-in.",
            ),
          timeoutMs,
        );
        pending = { redirect, resolve, reject, timer };
        Promise.resolve()
          .then(() => openExternal(browserURL.href))
          .catch(() =>
            this.cancel("Could not open your browser. Please try again."),
          );
      });
    },
    complete(url) {
      if (!pending || !callbackMatches(url, pending.redirect)) return false;
      const active = pending;
      pending = null;
      clearTimeout(active.timer);
      active.resolve(url);
      return true;
    },
    cancel(message = "Sign-in canceled. Please try again.") {
      if (!pending) return;
      const active = pending;
      pending = null;
      clearTimeout(active.timer);
      active.reject(new Error(message));
    },
  };
}
module.exports = {
  APP_URL,
  isAppURL,
  externalURL,
  bundledFile,
  createAuthBroker,
};
