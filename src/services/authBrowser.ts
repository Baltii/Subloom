import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { macosBridge, macosRequest } from "./macosBridge";
import { windowsBridge } from "./windowsBridge";

export function usesNativeAuthBrowser() {
  return (
    Platform.OS !== "web" || Boolean(macosBridge()) || Boolean(windowsBridge())
  );
}

export function authBrowserRedirect(path: "auth-callback" | "mailboxes") {
  // Desktop shells return browser callbacks to the original app profile.
  // Expo Linking's web implementation ignores the scheme option.
  return usesNativeAuthBrowser()
    ? "subloom://" + path
    : window.location.origin + "/" + path;
}

// Keep PKCE exchange in the app profile that created the verifier. Desktop
// bridges return the system browser callback to that same profile.
export async function openAuthBrowser(url: string, redirect: string) {
  if (macosBridge())
    return macosRequest<string>("auth.open", { url, redirect });
  const windows = windowsBridge();
  if (windows) return windows.openAuth(url, redirect);
  if (Platform.OS === "web") {
    window.location.assign(url);
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type === "success") return result.url;
  throw new Error("Sign-in canceled. You can try again whenever you’re ready.");
}
